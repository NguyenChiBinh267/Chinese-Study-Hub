import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { ownerTransaction } from "@/shared/db/transaction";
import { once } from "../../learning/infrastructure/postgres-local-repository";
import { databaseNow } from "../../learning/infrastructure/postgres-learning";
import { templateDefinition } from "../../learning/server/local-fixture";
import { CommandError } from "../../learning/domain/local-foundation";
import {
  ALGORITHM,
  SCHEDULER_CONFIG,
  previews,
  schedule,
} from "../domain/fsrs-adapter";
import type { RatingCommand } from "../domain/local-review";
import { Rating } from "ts-fsrs";
import { isDeepStrictEqual } from "node:util";

async function cardFor(
  c: PoolClient,
  uid: string,
  id: string,
  version: number,
  definition = templateDefinition,
) {
  const row = (
    await c.query(
      "SELECT * FROM app_private.cards WHERE user_id=$1 AND id=$2 FOR UPDATE",
      [uid, id],
    )
  ).rows[0];
  if (!row)
    throw new CommandError(
      404,
      "CARD_NOT_FOUND",
      "Không tìm thấy thẻ của bạn.",
    );
  if (row.version !== version)
    throw new CommandError(
      409,
      "STALE_CARD",
      "Thẻ đã thay đổi. Đọc lại trước khi ôn.",
    );
  if (
    row.algorithm !== ALGORITHM ||
    !isDeepStrictEqual(
      row.scheduler_config,
      JSON.parse(JSON.stringify(SCHEDULER_CONFIG)),
    )
  )
    throw new CommandError(
      409,
      "SCHEDULER_CONFIG",
      "Cấu hình thẻ khác phiên bản được pin.",
    );
  if (!definition(row.template_version_id))
    throw new CommandError(
      409,
      "TEMPLATE_UNAVAILABLE",
      "Thiếu định nghĩa thẻ hợp lệ.",
    );
  const now = await databaseNow(c);
  if (new Date(row.due_at) > now)
    throw new CommandError(409, "CARD_NOT_DUE", "Thẻ chưa đến hạn.");
  return { row, now };
}
export class PostgresReviewRepository {
  constructor(
    private pool: Pool,
    private definition = templateDefinition,
  ) {}
  reveal(uid: string, key: string, id: string, expectedVersion: number) {
    return ownerTransaction(
      this.pool,
      uid,
      (c) =>
        once(
          c,
          uid,
          `cards/${id}/reveal`,
          key,
          { expectedVersion },
          async () => {
            const { row, now } = await cardFor(
              c,
              uid,
              id,
              expectedVersion,
              this.definition,
            );
            await c.query(
              "UPDATE app_private.cards SET revealed_at=coalesce(revealed_at,$3) WHERE user_id=$1 AND id=$2",
              [uid, id, now],
            );
            return {
              cardId: id,
              version: row.version as number,
              back: this.definition(row.template_version_id)!.back,
              previews: previews(row.scheduler_card, now),
              algorithm: ALGORITHM,
            };
          },
        ),
      true,
    );
  }
  rate(uid: string, key: string, id: string, command: RatingCommand) {
    return ownerTransaction(
      this.pool,
      uid,
      (c) =>
        once(c, uid, `cards/${id}/rating`, key, command, async () => {
          const { row, now } = await cardFor(
            c,
            uid,
            id,
            command.expectedVersion,
            this.definition,
          );
          if (!row.revealed_at)
            throw new CommandError(
              409,
              "REVEAL_REQUIRED",
              "Lật thẻ trước khi tự đánh giá.",
            );
          const result = schedule(row.scheduler_card, now, command.rating);
          await c.query(
            `INSERT INTO app_private.review_logs(id,user_id,card_id,card_version,rating,before_card,after_card,scheduler_log,algorithm,scheduler_config,revealed_at,occurred_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [
              randomUUID(),
              uid,
              id,
              row.version,
              Rating[command.rating],
              row.scheduler_card,
              result.card,
              result.log,
              ALGORITHM,
              SCHEDULER_CONFIG,
              row.revealed_at,
              now,
            ],
          );
          await c.query(
            `UPDATE app_private.cards SET scheduler_card=$3,due_at=$4,version=version+1,revealed_at=NULL WHERE user_id=$1 AND id=$2`,
            [uid, id, result.card, result.card.due],
          );
          return {
            cardId: id,
            version: row.version + 1,
            dueAt: result.card.due,
            algorithm: ALGORITHM,
            rating: command.rating,
          };
        }),
      true,
    );
  }
}

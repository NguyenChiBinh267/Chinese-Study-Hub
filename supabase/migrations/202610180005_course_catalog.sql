-- Additive global metadata over existing immutable packages/exercise versions.
SET LOCAL ROLE csh_schema_owner;
CREATE TABLE app_content.courses(
 id uuid PRIMARY KEY,code text NOT NULL UNIQUE CHECK(code IN('FOUNDATION','HSK1','HSK2','HSK3','HSK4')),
 title text NOT NULL,description text NOT NULL,ordinal integer NOT NULL UNIQUE CHECK(ordinal>=0),
 syllabus_id text,release_ref text,availability text NOT NULL CHECK(availability IN('NOT_RELEASED','PRACTICE_ONLY','AVAILABLE')),
 coverage_verified boolean NOT NULL DEFAULT false,
 CHECK((code='FOUNDATION' AND syllabus_id IS NULL) OR (code<>'FOUNDATION' AND syllabus_id='hsk-exam-2025-11'))
);
CREATE TABLE app_content.units(
 id uuid PRIMARY KEY,course_id uuid NOT NULL REFERENCES app_content.courses(id),slug text NOT NULL,
 ordinal integer NOT NULL CHECK(ordinal>=0),title text NOT NULL,objective text NOT NULL,
 availability text NOT NULL CHECK(availability IN('NOT_RELEASED','PRACTICE_ONLY','AVAILABLE')),
 UNIQUE(course_id,ordinal),UNIQUE(course_id,slug)
);
CREATE TABLE app_content.lessons(
 id uuid PRIMARY KEY,unit_id uuid NOT NULL REFERENCES app_content.units(id),stable_key text NOT NULL UNIQUE,
 ordinal integer NOT NULL CHECK(ordinal>=0),current_version text NOT NULL,
 local_draft_allowed boolean NOT NULL DEFAULT false,UNIQUE(unit_id,ordinal)
);
-- Reuse packages as LessonVersion, exercise_versions as ExerciseVersion.
CREATE TABLE app_content.lesson_versions(
 package_id text PRIMARY KEY REFERENCES app_content.packages(version_id),
 lesson_id uuid NOT NULL REFERENCES app_content.lessons(id),version integer NOT NULL CHECK(version>0),
 UNIQUE(lesson_id,version),UNIQUE(lesson_id,package_id)
);
ALTER TABLE app_content.lessons ADD CONSTRAINT current_version_belongs_to_lesson FOREIGN KEY(id,current_version)
 REFERENCES app_content.lesson_versions(lesson_id,package_id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE app_content.unit_prerequisites(
 unit_id uuid NOT NULL REFERENCES app_content.units(id),required_unit_id uuid NOT NULL REFERENCES app_content.units(id),
 PRIMARY KEY(unit_id,required_unit_id),CHECK(unit_id<>required_unit_id)
);
CREATE TABLE app_content.lesson_skill_prerequisites(
 lesson_id uuid NOT NULL REFERENCES app_content.lessons(id),concept_id text NOT NULL,
 skill text NOT NULL CHECK(skill IN('recognition','reading','pinyin')),rule text NOT NULL CHECK(rule IN('foundation','secure')),
 PRIMARY KEY(lesson_id,concept_id,skill)
);
GRANT SELECT ON app_content.courses,app_content.units,app_content.lessons,app_content.lesson_versions,
 app_content.unit_prerequisites,app_content.lesson_skill_prerequisites TO csh_runtime;
-- No publisher DML for runtime; owner learner tables/RLS are unchanged.
DELETE FROM app_meta.runtime_proof;

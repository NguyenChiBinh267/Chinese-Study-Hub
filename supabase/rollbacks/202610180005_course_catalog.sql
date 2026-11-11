-- Disposable databases only: all existing learner history/package rows survive.
SET LOCAL ROLE csh_schema_owner;
ALTER TABLE app_content.lessons DROP CONSTRAINT current_version_belongs_to_lesson;
DROP TABLE app_content.lesson_skill_prerequisites,app_content.unit_prerequisites,app_content.lesson_versions,app_content.lessons,app_content.units,app_content.courses;

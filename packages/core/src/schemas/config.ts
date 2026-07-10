import * as Schema from "effect/Schema";

export const RuleSeveritySchema = Schema.Union([
  Schema.Literal("error"),
  Schema.Literal("warning"),
  Schema.Literal("info"),
  Schema.Literal("off"),
]);

export const DockerDoctorConfigSchema = Schema.Struct({
  categories: Schema.optional(
    Schema.Struct({
      "Best Practices": Schema.optional(RuleSeveritySchema),
      Compose: Schema.optional(RuleSeveritySchema),
      "Image Size": Schema.optional(RuleSeveritySchema),
      Performance: Schema.optional(RuleSeveritySchema),
      Security: Schema.optional(RuleSeveritySchema),
    })
  ),
  ignore: Schema.optional(
    Schema.Struct({
      files: Schema.optional(Schema.Array(Schema.String)),
    })
  ),
  rules: Schema.optional(Schema.Record(Schema.String, RuleSeveritySchema)),
});

export type DockerDoctorConfig = Schema.Schema.Type<
  typeof DockerDoctorConfigSchema
>;

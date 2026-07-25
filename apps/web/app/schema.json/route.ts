import { allRules } from "@docker-doctor/core";
import { NextResponse } from "next/server";

// Prerendered once per deploy, so the schema always matches the rule set the
// site was built against.
export const revalidate = false;

const SEVERITY_ENUM = ["error", "warning", "info", "off"];

export const GET = (): NextResponse => {
  const ruleProperties = Object.fromEntries(
    allRules.map((rule) => [
      rule.key,
      { description: rule.message, enum: SEVERITY_ENUM },
    ])
  );

  const categoryProperties = Object.fromEntries(
    [...new Set(allRules.map((rule) => rule.category))]
      .toSorted()
      .map((category) => [category, { enum: SEVERITY_ENUM }])
  );

  const schema = {
    $id: "https://docker-doctor.vercel.app/schema.json",
    $schema: "http://json-schema.org/draft-07/schema#",
    additionalProperties: false,
    description:
      "Configuration for the docker-doctor CLI (docker-doctor.config.{json,yaml,yml} or package.json#dockerDoctor).",
    properties: {
      $schema: { type: "string" },
      categories: {
        additionalProperties: false,
        description: "Override every rule in a category at once.",
        properties: categoryProperties,
        type: "object",
      },
      ignore: {
        additionalProperties: false,
        properties: {
          files: {
            description: "Glob patterns for files to exclude from scanning.",
            items: { type: "string" },
            type: "array",
          },
        },
        type: "object",
      },
      rules: {
        additionalProperties: { enum: SEVERITY_ENUM },
        description: "Override the severity of an individual rule.",
        properties: ruleProperties,
        type: "object",
      },
    },
    title: "Docker Doctor configuration",
    type: "object",
  };

  return NextResponse.json(schema);
};

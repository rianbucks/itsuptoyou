function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasType(type, value) {
  switch (type) {
    case "integer": return Number.isInteger(value);
    case "number": return typeof value === "number";
    case "string": return typeof value === "string";
    case "boolean": return typeof value === "boolean";
    case "array": return Array.isArray(value);
    case "object": return isObject(value);
    case "null": return value === null;
    default: return false;
  }
}

function matchesType(type, value) {
  return [].concat(type).some((item) => hasType(item, value));
}

function resolveRef(ref, context) {
  if (ref.startsWith("#/$defs/")) {
    return { schema: context.root.$defs[ref.slice("#/$defs/".length)], context };
  }
  if (!(ref in context.schemas)) throw new Error(`알 수 없는 스키마 참조: ${ref}`);
  const schema = context.schemas[ref];
  return { schema, context: { schemas: context.schemas, root: schema } };
}

function checkObject(schema, value, context, path, errors) {
  for (const key of schema.required ?? []) {
    if (!(key in value)) errors.push(`${path} 필수 항목 ${key}이(가) 없다`);
  }
  for (const [key, subSchema] of Object.entries(schema.properties ?? {})) {
    if (key in value) check(subSchema, value[key], context, `${path}.${key}`, errors);
  }
  if (schema.propertyNames) {
    for (const key of Object.keys(value)) check(schema.propertyNames, key, context, `${path} 키 ${key}`, errors);
  }
  if (schema.additionalProperties === undefined) return;
  for (const key of Object.keys(value)) {
    if (key in (schema.properties ?? {})) continue;
    if (schema.additionalProperties === false) errors.push(`${path} 허용되지 않은 항목 ${key}`);
    else if (isObject(schema.additionalProperties)) check(schema.additionalProperties, value[key], context, `${path}.${key}`, errors);
  }
}

function checkNumber(schema, value, path, errors) {
  if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} 값은 ${schema.minimum} 이상이어야 한다`);
  if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} 값은 ${schema.maximum} 이하여야 한다`);
  if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) errors.push(`${path} 값은 ${schema.exclusiveMinimum}보다 커야 한다`);
  if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) errors.push(`${path} 값은 ${schema.exclusiveMaximum}보다 작아야 한다`);
}

function checkString(schema, value, path, errors) {
  if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) errors.push(`${path} 값 ${JSON.stringify(value)}이(가) 형식 ${schema.pattern}에 맞지 않는다`);
}

function hasDuplicates(items) {
  return new Set(items.map((item) => JSON.stringify(item))).size !== items.length;
}

function checkArray(schema, value, context, path, errors) {
  if (schema.uniqueItems && hasDuplicates(value)) errors.push(`${path} 중복된 항목이 있다`);
  if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path} 항목이 ${schema.minItems}개 이상이어야 한다 (현재 ${value.length}개)`);
  if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path} 항목은 ${schema.maxItems}개 이하여야 한다 (현재 ${value.length}개)`);
  if (schema.items) value.forEach((item, index) => check(schema.items, item, context, `${path}[${index}]`, errors));
  if (!schema.contains) return;
  const count = value.filter((item) => collectErrors(schema.contains, item, context, path).length === 0).length;
  const min = schema.minContains ?? 1;
  const max = schema.maxContains ?? Infinity;
  if (count < min || count > max) errors.push(`${path} 조건을 만족하는 항목이 ${count}개다 (허용 ${min}~${max}개)`);
}

function check(schema, value, context, path, errors) {
  if (schema.$ref) {
    const target = resolveRef(schema.$ref, context);
    check(target.schema, value, target.context, path, errors);
  }
  if (schema.type && !matchesType(schema.type, value)) {
    errors.push(`${path} 타입은 ${[].concat(schema.type).join(" 또는 ")}이어야 한다`);
    return;
  }
  if (schema.enum && !schema.enum.some((item) => sameJson(item, value))) errors.push(`${path} 허용되지 않은 값 ${JSON.stringify(value)}`);
  if ("const" in schema && !sameJson(schema.const, value)) errors.push(`${path} 값은 ${JSON.stringify(schema.const)}이어야 한다`);
  if (schema.not && collectErrors(schema.not, value, context, path).length === 0) errors.push(`${path} 금지된 값이다`);
  for (const subSchema of schema.allOf ?? []) check(subSchema, value, context, path, errors);
  if (schema.anyOf && !schema.anyOf.some((subSchema) => collectErrors(subSchema, value, context, path).length === 0)) errors.push(`${path} 허용된 형태 중 어느 것과도 맞지 않는다`);
  if (schema.if) {
    const matched = collectErrors(schema.if, value, context, path).length === 0;
    const branch = matched ? schema.then : schema.else;
    if (branch) check(branch, value, context, path, errors);
  }
  if (typeof value === "number") checkNumber(schema, value, path, errors);
  if (typeof value === "string") checkString(schema, value, path, errors);
  if (isObject(value)) checkObject(schema, value, context, path, errors);
  if (Array.isArray(value)) checkArray(schema, value, context, path, errors);
}

export function collectErrors(schema, value, context, path = "$") {
  const errors = [];
  check(schema, value, context, path, errors);
  return errors;
}

export function validateAgainstSchema(schemaName, value, schemas) {
  const root = schemas[schemaName];
  return collectErrors(root, value, { schemas, root });
}

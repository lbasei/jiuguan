import contentTable from "@/content/adventurex-specials.json";

type RuleCondition = {
  identities?: string[];
  states?: string[];
  blockerPresent?: boolean;
  blockerKeywords?: string[];
  taskKeywords?: string[];
};

type SpecialRule = {
  id: string;
  when: RuleCondition;
  contentKey: string;
};

type SpecialContent = {
  name: string;
  keywords: string[];
  feedback: string;
};

type TodaySpecialTable = {
  version: number;
  host: { name: string };
  defaultContentKey: string;
  states: Array<{ id: string; label: string }>;
  rules: SpecialRule[];
  content: Record<string, SpecialContent>;
};

export type ResolveTodaySpecialInput = {
  identity: string;
  state: string;
  task: string;
  blocker: string;
};

export type ResolvedTodaySpecial = {
  name: string;
  bartender: string;
  keywords: string[];
  completion_hint: string;
  rule_id: string;
  content_key: string;
  content_version: number;
};

const table = contentTable as TodaySpecialTable;

export const TODAY_SPECIAL_STATES = table.states;

export function getTodaySpecialStateLabel(state: string) {
  return table.states.find((item) => item.id === state)?.label ?? state;
}

function containsAny(text: string, keywords: string[] | undefined) {
  if (!keywords?.length) return true;
  const normalized = text.toLocaleLowerCase("zh-CN");
  return keywords.some((keyword) => normalized.includes(keyword.toLocaleLowerCase("zh-CN")));
}

function matchesRule(rule: SpecialRule, input: ResolveTodaySpecialInput) {
  const condition = rule.when;
  const blockerPresent = Boolean(input.blocker.trim());

  if (condition.identities?.length && !condition.identities.includes(input.identity)) return false;
  if (condition.states?.length && !condition.states.includes(input.state)) return false;
  if (condition.blockerPresent != null && condition.blockerPresent !== blockerPresent) return false;
  if (!containsAny(input.blocker, condition.blockerKeywords)) return false;
  if (!containsAny(input.task, condition.taskKeywords)) return false;
  return true;
}

export function resolveTodaySpecial(input: ResolveTodaySpecialInput): ResolvedTodaySpecial {
  const matchedRule = table.rules.find((rule) => matchesRule(rule, input));
  const contentKey = matchedRule?.contentKey ?? table.defaultContentKey;
  const content = table.content[contentKey] ?? table.content[table.defaultContentKey];

  if (!content) {
    throw new Error("AdventureX 今日特调内容表缺少默认文案。");
  }

  return {
    name: content.name,
    bartender: table.host.name,
    keywords: [...content.keywords],
    completion_hint: content.feedback,
    rule_id: matchedRule?.id ?? "default",
    content_key: contentKey,
    content_version: table.version,
  };
}

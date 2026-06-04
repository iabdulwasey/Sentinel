import type { MarketRulesetInput } from "../../types/ruleset";
import EE_TALLINN_v1 from "./EE_TALLINN/v1";
import EE_TALLINN_v2 from "./EE_TALLINN/v2";
import PL_WARSAW_v1 from "./PL_WARSAW/v1";
import PT_LISBON_v1 from "./PT_LISBON/v1";
import RO_BUCHAREST_v1 from "./RO_BUCHAREST/v1";
import NG_LAGOS_v1 from "./NG_LAGOS/v1";
import ZA_JOHANNESBURG_v1 from "./ZA_JOHANNESBURG/v1";

/**
 * The market manifest. Adding a market = drop a new markets/<CODE>/vN.ts file and add
 * one line here. The engine itself never references a market by name — this is the only
 * place market files are enumerated.
 */
export const ALL_RULESETS: MarketRulesetInput[] = [
  EE_TALLINN_v1,
  EE_TALLINN_v2,
  PL_WARSAW_v1,
  PT_LISBON_v1,
  RO_BUCHAREST_v1,
  NG_LAGOS_v1,
  ZA_JOHANNESBURG_v1,
];

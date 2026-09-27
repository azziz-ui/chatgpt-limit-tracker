import { countTokens } from "gpt-tokenizer/encoding/o200k_base";

globalThis.CLTTokenizer = Object.freeze({ count: (text) => countTokens(text, { allowedSpecial: new Set(), disallowedSpecial: new Set() }) });

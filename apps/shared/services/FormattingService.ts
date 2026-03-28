import { formatNumber, formatGas, fromFixed8, toFixed8, formatAddress, formatHash, formatCountdown, formatCompactNumber } from "../utils/format";
import { parseStackItem, parseInvokeResult } from "../utils/neo";
import { parseBigInt, parseBool } from "../utils/parsers";

export class FormattingService {
  // Number formatting
  number = formatNumber;
  gas = formatGas;
  compact = formatCompactNumber;
  address = formatAddress;
  hash = formatHash;
  countdown = formatCountdown;

  // Conversion
  fromFixed8 = fromFixed8;
  toFixed8 = toFixed8;

  // Parsing
  parseStackItem = parseStackItem;
  parseResult = parseInvokeResult;
  parseBigInt = parseBigInt;
  parseBool = parseBool;
}

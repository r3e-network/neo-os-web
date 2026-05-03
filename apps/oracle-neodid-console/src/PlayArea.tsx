import { ConsoleToolPanel } from "@shared/components-react";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import { consoleConfig } from "./appConfig";

export default function PlayArea(props: PlayAreaProps) {
  return <ConsoleToolPanel config={consoleConfig} {...props} />;
}

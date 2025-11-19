import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type Point = { x: number; y: number };

type Props = {
  data: Point[];
  label: string;
  color?: string;
  height?: number;
};

export function Chart({ data, label, color = "#0f766e", height = 240 }: Props) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <XAxis
            dataKey="x"
            domain={["dataMin", "dataMax"]}
            type="number"
            tickFormatter={(v) => new Date(v * 1000).toLocaleTimeString()}
            minTickGap={30}
          />
          <YAxis />
          <Tooltip labelFormatter={(v) => new Date(v * 1000).toLocaleTimeString()} formatter={(value: number) => value.toFixed(3)} />
          <Line type="monotone" dataKey="y" stroke={color} dot={false} name={label} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

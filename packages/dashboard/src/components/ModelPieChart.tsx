'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { PieLabelRenderProps } from 'recharts';

interface ModelData {
  model: string;
  count: number;
  totalCost: number;
}

interface Props {
  data: ModelData[];
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

function renderLabel(props: PieLabelRenderProps): string {
  // PieLabelRenderProps includes data entry fields via index lookup
  const name = typeof props.name === 'string' ? props.name : String(props.name ?? '');
  const percent = typeof props.percent === 'number' ? props.percent : 0;
  return `${name.replace('claude-', '')} (${(percent * 100).toFixed(0)}%)`;
}

export function ModelPieChart({ data }: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
      <h2 className="text-lg font-semibold mb-4">모델 분포</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="totalCost"
            nameKey="model"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={renderLabel}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => typeof value === 'number' ? `$${value.toFixed(4)}` : value} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

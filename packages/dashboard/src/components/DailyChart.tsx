'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DailyData {
  date: string;
  [memberName: string]: string | number;
}

interface Props {
  data: DailyData[];
  members: string[];
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export function DailyChart({ data, members }: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
      <h2 className="text-lg font-semibold mb-4">일별 비용 추이</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <XAxis dataKey="date" />
          <YAxis tickFormatter={(v) => `$${v}`} />
          <Tooltip formatter={(value) => typeof value === 'number' ? `$${value.toFixed(4)}` : value} />
          <Legend />
          {members.map((name, i) => (
            <Bar key={name} dataKey={name} stackId="cost" fill={COLORS[i % COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

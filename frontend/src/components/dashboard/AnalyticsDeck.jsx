/**
 * @file AnalyticsDeck.jsx
 * @description Comparative analytics dashboard for historical spill data.
 */
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const MOCK_MONTHLY = [
  { name: 'Jan', count: 4 }, { name: 'Feb', count: 7 }, { name: 'Mar', count: 2 },
  { name: 'Apr', count: 5 }, { name: 'May', count: 8 }, { name: 'Jun', count: 12 },
  { name: 'Jul', count: 6 }, { name: 'Aug', count: 9 }, { name: 'Sep', count: 4 },
  { name: 'Oct', count: 3 }, { name: 'Nov', count: 5 }, { name: 'Dec', count: 8 }
];

const SEVERITY_DATA = [
  { name: 'Critical', value: 15, color: '#dc3545' },
  { name: 'High', value: 30, color: '#fd7e14' },
  { name: 'Medium', value: 45, color: '#f0ad4e' },
  { name: 'Low', value: 20, color: '#28a745' }
];

const RESPONSE_TREND = [
  { month: 'Jan', time: 14 }, { month: 'Mar', time: 12 }, { month: 'May', time: 10 },
  { month: 'Jul', time: 8.5 }, { month: 'Sep', time: 7 }, { month: 'Nov', time: 6.2 }
];

export default function AnalyticsDeck() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', padding: '20px' }}>
      
      {/* Monthly Spills */}
      <div style={cardStyle}>
        <h3 style={titleStyle}>Monthly Detection Volume</h3>
        <p style={subStyle}>SAR incidents over the last 12 months</p>
        <div style={{ height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MOCK_MONTHLY} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              <Bar dataKey="count" fill="#1a4a8a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Severity Distribution */}
      <div style={cardStyle}>
        <h3 style={titleStyle}>Severity Distribution</h3>
        <p style={subStyle}>Breakdown by estimated environmental impact</p>
        <div style={{ height: 250, display: 'flex', alignItems: 'center' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={SEVERITY_DATA} innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                {SEVERITY_DATA.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '20px' }}>
            {SEVERITY_DATA.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: d.color }} />
                <span style={{ color: '#475569' }}>{d.name}</span>
                <span style={{ fontWeight: 600, color: '#0f2e59', marginLeft: 'auto' }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Response Time Trend */}
      <div style={cardStyle}>
        <h3 style={titleStyle}>Average Response Time</h3>
        <p style={subStyle}>Hours from detection to interception</p>
        <div style={{ height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={RESPONSE_TREND} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip />
              <Line type="monotone" dataKey="time" stroke="#0f2e59" strokeWidth={3} dot={{ r: 4, fill: '#0f2e59' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Repeat Offenders */}
      <div style={cardStyle}>
        <h3 style={titleStyle}>Top Hotspot Zones</h3>
        <p style={subStyle}>Regions with highest frequency of dark spills</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          {[
            { zone: 'Mumbai High', incidents: 42, color: '#dc3545' },
            { zone: 'Kochi Port Approach', incidents: 28, color: '#fd7e14' },
            { zone: 'Chennai Coastal', incidents: 19, color: '#f0ad4e' },
            { zone: 'Paradip Anchorage', incidents: 14, color: '#28a745' },
            { zone: 'Gujarat Coast', incidents: 11, color: '#4a7ab5' },
          ].map((z, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '120px', fontSize: '0.875rem', color: '#475569', fontWeight: 500 }}>{z.zone}</div>
              <div style={{ flex: 1, background: '#f1f5f9', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(z.incidents / 42) * 100}%`, height: '100%', background: z.color, borderRadius: '4px' }} />
              </div>
              <div style={{ width: '30px', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600, color: '#0f2e59' }}>{z.incidents}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

const cardStyle = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
};

const titleStyle = {
  margin: '0 0 4px',
  fontSize: '1rem',
  fontWeight: 600,
  color: '#0f2e59'
};

const subStyle = {
  margin: '0 0 20px',
  fontSize: '0.8125rem',
  color: '#64748b'
};

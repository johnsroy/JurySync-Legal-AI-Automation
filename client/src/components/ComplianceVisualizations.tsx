import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ComplianceScores {
  overall: number;
  regulatory: number;
  clarity: number;
  risk: number;
}

interface RiskDistribution {
  high: number;
  medium: number;
  low: number;
}

interface VisualizationProps {
  issueFrequency: number[];
  riskTrend: number[];
  complianceScores: ComplianceScores;
  riskDistribution: RiskDistribution;
}

export function ComplianceVisualizations({ 
  issueFrequency,
  riskTrend,
  complianceScores,
  riskDistribution
}: VisualizationProps) {
  const complianceData = [
    { name: 'Overall', value: complianceScores.overall },
    { name: 'Regulatory', value: complianceScores.regulatory },
    { name: 'Clarity', value: complianceScores.clarity },
    { name: 'Risk', value: complianceScores.risk },
  ];

  const riskDistributionData = [
    { name: 'High', value: riskDistribution.high },
    { name: 'Medium', value: riskDistribution.medium },
    { name: 'Low', value: riskDistribution.low },
  ];

  const riskTrendData = riskTrend.map((value, index) => ({
    name: `Section ${index + 1}`,
    risk: value,
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Compliance Scores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={complianceData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="name" />
                <PolarRadiusAxis domain={[0, 100]} />
                <Radar
                  name="Compliance"
                  dataKey="value"
                  stroke="#2563eb"
                  fill="#3b82f6"
                  fillOpacity={0.6}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskDistributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Risk Trend Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={riskTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="risk"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Component, ElementRef, ViewChild, input, effect, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Title } from 'chart.js';
import { DatabaseService, Character, Session, Roll } from '../../../../core/db/database.service';

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Title);

export interface SessionDataPoint {
  sessionName: string;
  sessionDate: string;
  charStats: Record<number, { average: number; luckPct: number; totalRolls: number }>;
}

@Component({
  selector: 'app-campaign-trend-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './campaign-trend-chart.component.html',
  styleUrl: './campaign-trend-chart.component.css',
})
export class CampaignTrendChartComponent implements OnDestroy {
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly db = inject(DatabaseService);

  campaignId = input<number | undefined>(undefined);
  characters = input<Character[]>([]);
  metric = signal<'average' | 'luckPct'>('average');

  isLoading = signal<boolean>(false);
  private chart: Chart | null = null;

  constructor() {
    effect(() => {
      const campId = this.campaignId();
      const chars = this.characters();
      const m = this.metric();
      if (campId) {
        this.loadTrendDataAndRender(campId, chars, m);
      }
    });
  }

  setMetric(m: 'average' | 'luckPct') {
    this.metric.set(m);
  }

  private async loadTrendDataAndRender(campaignId: number, chars: Character[], m: 'average' | 'luckPct') {
    this.isLoading.set(true);
    try {
      // Fetch sessions for campaign in date order
      const sessions = await this.db.sessions.where('campaignId').equals(campaignId).sortBy('date');
      if (!sessions || sessions.length === 0) {
        this.destroyChart();
        return;
      }

      const labels: string[] = [];
      const sessionPoints: SessionDataPoint[] = [];

      for (const sess of sessions) {
        if (!sess.id) continue;
        const rolls = await this.db.rolls.where('sessionId').equals(sess.id).toArray();
        const dateStr = sess.date ? new Date(sess.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }) : '';
        const label = sess.name ? `${sess.name} (${dateStr})` : `Session (${dateStr})`;
        labels.push(label);

        const charStatsRecord: Record<number, { average: number; luckPct: number; totalRolls: number }> = {};
        for (const c of chars) {
          if (!c.id) continue;
          const charRolls = rolls.filter(r => r.characterId === c.id).map(r => r.value);
          const N = charRolls.length;
          if (N === 0) {
            charStatsRecord[c.id] = { average: 0, luckPct: 0, totalRolls: 0 };
          } else {
            const avg = charRolls.reduce((a, b) => a + b, 0) / N;
            const lucky = charRolls.filter(r => r >= 11).length;
            const luckPct = (lucky / N) * 100;
            charStatsRecord[c.id] = { average: avg, luckPct, totalRolls: N };
          }
        }

        sessionPoints.push({
          sessionName: sess.name,
          sessionDate: dateStr,
          charStats: charStatsRecord,
        });
      }

      // Build datasets for each character
      const datasets = chars.filter(c => c.id !== undefined).map(c => {
        const data = sessionPoints.map(sp => {
          const st = sp.charStats[c.id!];
          if (!st || st.totalRolls === 0) return null;
          return m === 'average' ? parseFloat(st.average.toFixed(2)) : parseFloat(st.luckPct.toFixed(1));
        });

        const displayName = c.name || c.playerName;

        return {
          label: c.isDM ? 'Our Dungeon Master' : displayName,
          data,
          borderColor: c.color || '#3b82f6',
          backgroundColor: c.color || '#3b82f6',
          tension: 0.3,
          spanGaps: true,
          pointRadius: 4,
          pointHoverRadius: 7,
        };
      });

      this.renderChart(labels, datasets, m);
    } catch (err) {
      console.error('Error loading campaign trend data:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  private renderChart(labels: string[], datasets: any[], m: 'average' | 'luckPct') {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;

    const titleText = m === 'average' ? 'Session Average Roll Trajectory (Baseline: 10.5)' : 'Session Luck % Trajectory (Baseline: 50%)';
    const yAxisSuffix = m === 'average' ? '' : '%';

    if (this.chart) {
      this.chart.data.labels = labels;
      this.chart.data.datasets = datasets;
      this.chart.options.plugins!.title!.text = titleText;
      this.chart.update();
      return;
    }

    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { color: '#cbd5e1', font: { family: 'Outfit', size: 12 } },
          },
          title: {
            display: true,
            text: titleText,
            color: '#94a3b8',
            font: { family: 'Outfit', size: 14, weight: 'bold' },
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const val = context.raw;
                if (val === null || val === undefined) return `${context.dataset.label}: No rolls logged`;
                return `${context.dataset.label}: ${val}${yAxisSuffix}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#cbd5e1' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
          },
          y: {
            ticks: { color: '#cbd5e1', callback: (v) => `${v}${yAxisSuffix}` },
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            suggestedMin: m === 'average' ? 5 : 20,
            suggestedMax: m === 'average' ? 16 : 80,
          },
        },
      },
    });
  }

  private destroyChart() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  ngOnDestroy() {
    this.destroyChart();
  }
}

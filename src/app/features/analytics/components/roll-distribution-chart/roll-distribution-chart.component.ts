import { Component, ElementRef, ViewChild, input, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title } from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title);

@Component({
  selector: 'app-roll-distribution-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './roll-distribution-chart.component.html',
  styleUrl: './roll-distribution-chart.component.css',
})
export class RollDistributionChartComponent implements OnDestroy {
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  rolls = input<number[]>([]);
  playerLabel = input<string>('Overall');

  private chart: Chart | null = null;

  constructor() {
    effect(() => {
      const rollValues = this.rolls();
      const label = this.playerLabel();
      setTimeout(() => this.renderChart(rollValues, label), 0);
    });
  }

  private renderChart(rollValues: number[], label: string) {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;

    const counts = new Array(20).fill(0);
    for (const r of rollValues) {
      if (r >= 1 && r <= 20) {
        counts[r - 1]++;
      }
    }

    const total = rollValues.length || 1;
    const percentages = counts.map(c => parseFloat(((c / total) * 100).toFixed(1)));
    const labels = Array.from({ length: 20 }, (_, i) => `${i + 1}`);

    const backgroundColors = labels.map(valStr => {
      const val = parseInt(valStr);
      if (val === 1) return '#ef4444';   // Nat 1 red
      if (val === 20) return '#f59e0b';  // Nat 20 amber/gold
      if (val >= 11) return '#3b82f6';   // High blue
      return '#8b5cf6';                  // Low purple
    });

    if (this.chart) {
      this.chart.data.labels = labels;
      this.chart.data.datasets[0].data = percentages;
      this.chart.data.datasets[0].label = `${label} Roll Distribution (%)`;
      this.chart.update();
      return;
    }

    this.chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: `${label} Roll Distribution (%)`,
            data: percentages,
            backgroundColor: backgroundColors,
            borderRadius: 6,
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: { color: '#cbd5e1', font: { family: 'Outfit', size: 13 } },
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const face = context.dataIndex + 1;
                const count = counts[context.dataIndex];
                const pct = (context.raw as number).toFixed(1);
                const diff = ((context.raw as number) - 5.0).toFixed(1);
                const diffStr = parseFloat(diff) >= 0 ? `+${diff}%` : `${diff}%`;
                return `Face ${face}: ${count} rolls (${pct}%) — Variance vs 5% target: ${diffStr}`;
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'd20 Face Value (1–20)', color: '#94a3b8' },
            ticks: { color: '#cbd5e1' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
          },
          y: {
            title: { display: true, text: 'Frequency Percentage (%)', color: '#94a3b8' },
            ticks: { color: '#cbd5e1', callback: (v) => `${v}%` },
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            suggestedMax: 15,
            beginAtZero: true,
          },
        },
      },
    });
  }

  ngOnDestroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
}

import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import { LabelLayout } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';

// Shared registration for every dashboard, including charts outside ChartWrapper.
echarts.use([
  BarChart, LineChart, PieChart,
  GridComponent, LegendComponent, TooltipComponent, TitleComponent,
  DataZoomComponent, GraphicComponent, MarkLineComponent, LabelLayout,
  CanvasRenderer,
]);

export { echarts };

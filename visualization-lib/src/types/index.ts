export interface ChartData {
  [key: string]: any;
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'table';
  title?: string;
  xAxis?: string;
  yAxis?: string;
  color?: string;
  width?: number;
  height?: number;
}

export interface TableConfig {
  columns: TableColumn[];
  sortable?: boolean;
  filterable?: boolean;
  paginated?: boolean;
  pageSize?: number;
}

export interface TableColumn {
  key: string;
  label: string;
  type?: 'string' | 'number' | 'date' | 'boolean';
  sortable?: boolean;
  filterable?: boolean;
  width?: number;
}

export interface VisualizationProps {
  data: ChartData[];
  config: ChartConfig;
  loading?: boolean;
  error?: string;
  onDataPointClick?: (data: ChartData) => void;
}
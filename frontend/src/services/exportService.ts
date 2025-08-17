import { QueryResult, VisualizationRecommendation } from '@/types';
import { toast } from 'react-hot-toast';

export class ExportService {
  /**
   * Export data as CSV
   */
  static async exportCSV(data: QueryResult, filename?: string): Promise<void> {
    try {
      const csvContent = this.convertToCSV(data);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `query-results-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      URL.revokeObjectURL(url);
      toast.success('CSV exported successfully!');
    } catch (error) {
      console.error('CSV export failed:', error);
      toast.error('Failed to export CSV');
    }
  }

  /**
   * Export data as JSON
   */
  static async exportJSON(data: QueryResult, filename?: string): Promise<void> {
    try {
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `query-results-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
      toast.success('JSON exported successfully!');
    } catch (error) {
      console.error('JSON export failed:', error);
      toast.error('Failed to export JSON');
    }
  }

  /**
   * Export chart as PNG
   */
  static async exportChartPNG(chartElement: HTMLElement | null, filename?: string): Promise<void> {
    if (!chartElement) {
      toast.error('Chart element not found');
      return;
    }

    try {
      // Use html2canvas to capture the chart element
      const html2canvas = await import('html2canvas');
      const canvas = await html2canvas.default(chartElement, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true
      });

      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error('Failed to generate chart image');
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || `chart-${new Date().toISOString().split('T')[0]}.png`;
        link.click();
        
        URL.revokeObjectURL(url);
        toast.success('Chart exported as PNG!');
      }, 'image/png');
    } catch (error) {
      console.error('PNG export failed:', error);
      toast.error('Failed to export chart as PNG');
    }
  }

  /**
   * Export chart as SVG
   */
  static async exportChartSVG(chartElement: HTMLElement | null, filename?: string): Promise<void> {
    if (!chartElement) {
      toast.error('Chart element not found');
      return;
    }

    try {
      // Find SVG element within the chart
      const svgElement = chartElement.querySelector('svg');
      if (!svgElement) {
        toast.error('SVG chart not found');
        return;
      }

      // Get SVG content
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `chart-${new Date().toISOString().split('T')[0]}.svg`;
      link.click();
      
      URL.revokeObjectURL(url);
      toast.success('Chart exported as SVG!');
    } catch (error) {
      console.error('SVG export failed:', error);
      toast.error('Failed to export chart as SVG');
    }
  }

  /**
   * Export comprehensive report as PDF
   */
  static async exportPDF(
    data: QueryResult,
    visualization?: VisualizationRecommendation,
    chartElement?: HTMLElement | null,
    filename?: string
  ): Promise<void> {
    try {
      const jsPDF = await import('jspdf');
      const pdf = new jsPDF.default();
      
      // Add title
      pdf.setFontSize(20);
      pdf.text('Query Results Report', 20, 30);
      
      // Add metadata
      pdf.setFontSize(12);
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 45);
      pdf.text(`Rows: ${data.rowCount}`, 20, 55);
      pdf.text(`Execution Time: ${data.executionTime}ms`, 20, 65);
      
      // Add query if available
      if (data.query) {
        pdf.text('Query:', 20, 80);
        pdf.setFontSize(10);
        const queryLines = pdf.splitTextToSize(data.query, 170);
        pdf.text(queryLines, 20, 90);
      }
      
      // Add chart if available
      if (chartElement) {
        try {
          const html2canvas = await import('html2canvas');
          const canvas = await html2canvas.default(chartElement, {
            backgroundColor: '#ffffff',
            scale: 1,
            useCORS: true,
            allowTaint: true
          });
          
          const imgData = canvas.toDataURL('image/png');
          const imgWidth = 170;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          pdf.addImage(imgData, 'PNG', 20, 110, imgWidth, imgHeight);
        } catch (error) {
          console.warn('Failed to include chart in PDF:', error);
        }
      }
      
      // Add data table (first page only)
      pdf.setFontSize(8);
      const startY = chartElement ? 200 : 110;
      const maxRows = Math.min(data.data.length, 20); // Limit to prevent overflow
      
      // Table headers
      let x = 20;
      data.columns.forEach((column, index) => {
        pdf.text(column, x, startY);
        x += 30;
      });
      
      // Table rows
      data.data.slice(0, maxRows).forEach((row, rowIndex) => {
        x = 20;
        data.columns.forEach((column) => {
          const value = String(row[column] || '');
          pdf.text(value.length > 8 ? value.substring(0, 8) + '...' : value, x, startY + 10 + (rowIndex * 10));
          x += 30;
        });
      });
      
      // Save PDF
      pdf.save(filename || `query-report-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF report exported successfully!');
    } catch (error) {
      console.error('PDF export failed:', error);
      toast.error('Failed to export PDF report');
    }
  }

  /**
   * Convert query result to CSV format
   */
  private static convertToCSV(data: QueryResult): string {
    const headers = data.columns.join(',');
    const rows = data.data.map(row => 
      data.columns.map(column => {
        const value = row[column];
        // Handle values that might contain commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    );
    
    return [headers, ...rows].join('\n');
  }

  /**
   * Get appropriate filename based on export type
   */
  static getDefaultFilename(type: 'csv' | 'json' | 'png' | 'svg' | 'pdf', prefix = 'export'): string {
    const timestamp = new Date().toISOString().split('T')[0];
    return `${prefix}-${timestamp}.${type}`;
  }
}

export default ExportService;
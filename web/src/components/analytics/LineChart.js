import React from 'react';
import {
  Box,
  useColorModeValue,
  useTheme,
} from '@chakra-ui/react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const LineChart = ({
  data,
  labels,
  height = 300,
  showLegend = true,
  showGrid = true,
  fill = false,
  tension = 0.4,
  tooltipEnabled = true,
  borderWidth = 2,
  pointRadius = 3,
  customColors,
  yAxisMin,
  yAxisMax,
  yAxisStepSize,
  title,
  ...props
}) => {
  const theme = useTheme();
  const gridColor = useColorModeValue('rgba(0, 0, 0, 0.1)', 'rgba(255, 255, 255, 0.1)');
  const textColor = useColorModeValue('rgba(0, 0, 0, 0.7)', 'rgba(255, 255, 255, 0.7)');
  
  // Default colors for datasets
  const defaultColors = [
    { borderColor: '#3182CE', backgroundColor: 'rgba(49, 130, 206, 0.1)' },  // blue.500
    { borderColor: '#38A169', backgroundColor: 'rgba(56, 161, 105, 0.1)' },  // green.500
    { borderColor: '#D69E2E', backgroundColor: 'rgba(214, 158, 46, 0.1)' },  // yellow.500
    { borderColor: '#E53E3E', backgroundColor: 'rgba(229, 62, 62, 0.1)' },   // red.500
    { borderColor: '#805AD5', backgroundColor: 'rgba(128, 90, 213, 0.1)' },  // purple.500
    { borderColor: '#319795', backgroundColor: 'rgba(49, 151, 149, 0.1)' },  // teal.500
  ];
  
  // Prepare datasets with colors
  const datasets = Array.isArray(data) ? data.map((dataset, index) => {
    const colorIndex = index % defaultColors.length;
    const colors = customColors?.[index] || defaultColors[colorIndex];
    
    return {
      ...dataset,
      borderColor: colors.borderColor,
      backgroundColor: fill ? colors.backgroundColor : 'transparent',
      borderWidth,
      pointRadius,
      pointBackgroundColor: colors.borderColor,
      pointBorderColor: 'transparent',
      tension,
      fill,
    };
  }) : [];
  
  // Chart data
  const chartData = {
    labels,
    datasets,
  };
  
  // Chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: showLegend,
        position: 'top',
        labels: {
          color: textColor,
          boxWidth: 12,
          padding: 10,
          usePointStyle: true,
        },
      },
      title: {
        display: !!title,
        text: title,
        color: textColor,
        font: {
          size: 14,
          weight: 'bold',
        },
        padding: {
          top: 10,
          bottom: 10,
        },
      },
      tooltip: {
        enabled: tooltipEnabled,
        mode: 'index',
        intersect: false,
        backgroundColor: theme.colors.gray[700],
        titleColor: theme.colors.white,
        bodyColor: theme.colors.white,
        borderColor: theme.colors.gray[600],
        borderWidth: 1,
        padding: 10,
        titleFont: {
          size: 12,
          weight: 'bold',
        },
        bodyFont: {
          size: 12,
        },
        displayColors: true,
        boxWidth: 8,
        boxHeight: 8,
      },
    },
    scales: {
      x: {
        grid: {
          display: showGrid,
          color: gridColor,
          borderColor: gridColor,
        },
        ticks: {
          color: textColor,
          maxRotation: 0,
          autoSkipPadding: 15,
        },
      },
      y: {
        min: yAxisMin,
        max: yAxisMax,
        ticks: {
          color: textColor,
          stepSize: yAxisStepSize,
        },
        grid: {
          display: showGrid,
          color: gridColor,
          borderColor: gridColor,
        },
      },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    hover: {
      mode: 'index',
      intersect: false,
    },
  };
  
  return (
    <Box height={height} width="100%" position="relative" {...props}>
      <Line data={chartData} options={options} />
    </Box>
  );
};

export default LineChart; 
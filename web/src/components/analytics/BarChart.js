import React from 'react';
import {
  Box,
  useColorModeValue,
  useTheme,
} from '@chakra-ui/react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const BarChart = ({
  data,
  labels,
  height = 300,
  showLegend = true,
  showGrid = true,
  tooltipEnabled = true,
  horizontal = false,
  stacked = false,
  customColors,
  yAxisMin,
  yAxisMax,
  yAxisStepSize,
  title,
  barThickness,
  maxBarThickness,
  ...props
}) => {
  const theme = useTheme();
  const gridColor = useColorModeValue('rgba(0, 0, 0, 0.1)', 'rgba(255, 255, 255, 0.1)');
  const textColor = useColorModeValue('rgba(0, 0, 0, 0.7)', 'rgba(255, 255, 255, 0.7)');
  
  // Default colors for datasets
  const defaultColors = [
    { backgroundColor: 'rgba(49, 130, 206, 0.8)', hoverBackgroundColor: 'rgba(49, 130, 206, 1)' },    // blue.500
    { backgroundColor: 'rgba(56, 161, 105, 0.8)', hoverBackgroundColor: 'rgba(56, 161, 105, 1)' },    // green.500
    { backgroundColor: 'rgba(214, 158, 46, 0.8)', hoverBackgroundColor: 'rgba(214, 158, 46, 1)' },    // yellow.500
    { backgroundColor: 'rgba(229, 62, 62, 0.8)', hoverBackgroundColor: 'rgba(229, 62, 62, 1)' },      // red.500
    { backgroundColor: 'rgba(128, 90, 213, 0.8)', hoverBackgroundColor: 'rgba(128, 90, 213, 1)' },    // purple.500
    { backgroundColor: 'rgba(49, 151, 149, 0.8)', hoverBackgroundColor: 'rgba(49, 151, 149, 1)' },    // teal.500
  ];
  
  // Prepare datasets with colors
  const datasets = Array.isArray(data) ? data.map((dataset, index) => {
    const colorIndex = index % defaultColors.length;
    const colors = customColors?.[index] || defaultColors[colorIndex];
    
    return {
      ...dataset,
      backgroundColor: colors.backgroundColor,
      hoverBackgroundColor: colors.hoverBackgroundColor,
      barThickness,
      maxBarThickness,
      borderRadius: 4,
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
    indexAxis: horizontal ? 'y' : 'x',
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
        stacked,
        grid: {
          display: horizontal ? showGrid : false,
          color: gridColor,
          borderColor: gridColor,
        },
        ticks: {
          color: textColor,
          maxRotation: horizontal ? 0 : 45,
          minRotation: horizontal ? 0 : 45,
          autoSkipPadding: 10,
        },
      },
      y: {
        stacked,
        min: yAxisMin,
        max: yAxisMax,
        ticks: {
          color: textColor,
          stepSize: yAxisStepSize,
        },
        grid: {
          display: horizontal ? false : showGrid,
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
      <Bar data={chartData} options={options} />
    </Box>
  );
};

export default BarChart; 
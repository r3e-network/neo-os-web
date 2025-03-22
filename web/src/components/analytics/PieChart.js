import React from 'react';
import {
  Box,
  useColorModeValue,
  useTheme,
} from '@chakra-ui/react';
import { Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const PieChart = ({
  data,
  labels,
  height = 300,
  showLegend = true,
  isDoughnut = false,
  tooltipEnabled = true,
  cutout,
  customColors,
  title,
  legendPosition = 'top',
  ...props
}) => {
  const theme = useTheme();
  const textColor = useColorModeValue('rgba(0, 0, 0, 0.7)', 'rgba(255, 255, 255, 0.7)');
  
  // Default colors for chart segments
  const defaultColors = [
    'rgba(49, 130, 206, 0.8)',   // blue.500
    'rgba(56, 161, 105, 0.8)',   // green.500
    'rgba(214, 158, 46, 0.8)',   // yellow.500
    'rgba(229, 62, 62, 0.8)',    // red.500
    'rgba(128, 90, 213, 0.8)',   // purple.500
    'rgba(49, 151, 149, 0.8)',   // teal.500
    'rgba(246, 173, 85, 0.8)',   // orange.300
    'rgba(159, 122, 234, 0.8)',  // purple.400
    'rgba(237, 100, 166, 0.8)',  // pink.400
    'rgba(112, 178, 214, 0.8)',  // blue.300
  ];
  
  // Hover color adjustment - slightly more opaque
  const hoverColors = defaultColors.map(color => color.replace('0.8', '1'));
  
  // Prepare chart data
  const chartData = {
    labels,
    datasets: [{
      data: data,
      backgroundColor: customColors || defaultColors,
      hoverBackgroundColor: customColors ? customColors.map(c => c.replace('0.8', '1')) : hoverColors,
      borderWidth: 1,
      borderColor: useColorModeValue('white', 'gray.800'),
    }],
  };
  
  // Chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: isDoughnut ? (cutout || '50%') : 0,
    plugins: {
      legend: {
        display: showLegend,
        position: legendPosition,
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
  };
  
  return (
    <Box height={height} width="100%" position="relative" {...props}>
      {isDoughnut ? (
        <Doughnut data={chartData} options={options} />
      ) : (
        <Pie data={chartData} options={options} />
      )}
    </Box>
  );
};

export default PieChart; 
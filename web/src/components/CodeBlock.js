import React from 'react';
import { Box, useColorModeValue } from '@chakra-ui/react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';

/**
 * CodeBlock component for syntax highlighting
 */
const CodeBlock = ({ code, language = 'javascript' }) => {
  const bgColor = useColorModeValue('gray.50', 'gray.800');
  
  return (
    <Box borderRadius="md" overflow="hidden" bg={bgColor} fontSize="sm">
      <SyntaxHighlighter
        language={language}
        style={tomorrow}
        customStyle={{ margin: 0, borderRadius: '4px' }}
      >
        {code}
      </SyntaxHighlighter>
    </Box>
  );
};

export default CodeBlock; 
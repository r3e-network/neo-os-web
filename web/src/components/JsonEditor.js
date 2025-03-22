import React, { useState, useEffect } from 'react';
import { Box, Textarea, FormHelperText } from '@chakra-ui/react';

/**
 * A component for editing JSON objects with validation
 */
const JsonEditor = ({ value, onChange, height = "100px" }) => {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);

  // Convert prop value to string when it changes
  useEffect(() => {
    try {
      const jsonStr = JSON.stringify(value || {}, null, 2);
      setText(jsonStr);
    } catch (err) {
      console.error('Error converting JSON to string:', err);
    }
  }, [value]);

  const handleChange = (e) => {
    const newText = e.target.value;
    setText(newText);

    try {
      // Only call onChange if the JSON is valid
      if (newText.trim() === '') {
        onChange({});
        setError(null);
      } else {
        const parsed = JSON.parse(newText);
        onChange(parsed);
        setError(null);
      }
    } catch (err) {
      setError('Invalid JSON format');
    }
  };

  return (
    <Box>
      <Textarea
        value={text}
        onChange={handleChange}
        fontFamily="mono"
        height={height}
        placeholder="{}"
      />
      {error && (
        <FormHelperText color="red.500">{error}</FormHelperText>
      )}
    </Box>
  );
};

export default JsonEditor; 
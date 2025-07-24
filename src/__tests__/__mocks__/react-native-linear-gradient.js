import React from 'react';
import { View } from 'react-native';

const LinearGradient = ({ children, style, ...props }) => {
  return React.createElement(View, { style, ...props }, children);
};

export default LinearGradient;
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.useFakeTimers();

test('renders correctly', async () => {
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<App />);
  });
  
  // Fast-forward and exhaust all splash screen timeouts inside act()
  await ReactTestRenderer.act(async () => {
    jest.runAllTimers();
  });
});

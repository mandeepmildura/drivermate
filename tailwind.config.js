/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Status colours for on-time / delayed / late banding on the run screen
        ontime: '#16a34a',
        delayed: '#f59e0b',
        late: '#dc2626',
      },
      fontSize: {
        // Tablet-portrait, glanceable-while-driving sizes
        instruction: ['3.5rem', { lineHeight: '1.05', fontWeight: '800' }],
        stop: ['1.75rem', { lineHeight: '1.2', fontWeight: '700' }],
        counter: ['5rem', { lineHeight: '1', fontWeight: '900' }],
      },
      spacing: {
        // Minimum tap target for a gloved/distracted thumb
        touch: '4.5rem',
      },
    },
  },
  plugins: [],
};

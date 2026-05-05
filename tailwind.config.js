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
        // Material 3 light-theme tokens used by the /run screen (run-screen-concept-v2-light.html)
        primary: '#00685f',
        'primary-container': '#008378',
        'on-primary': '#ffffff',
        'on-primary-container': '#f4fffc',
        secondary: '#0051d5',
        'secondary-container': '#316bf3',
        'on-secondary': '#ffffff',
        surface: '#f7f9fb',
        'surface-container': '#eceef0',
        'surface-container-high': '#e6e8ea',
        'surface-container-highest': '#e0e3e5',
        'on-surface': '#191c1e',
        'on-surface-variant': '#3d4947',
        'outline-variant': '#bcc9c6',
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

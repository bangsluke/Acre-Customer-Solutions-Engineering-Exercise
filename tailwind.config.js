/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        acre: {
          purple: '#3D4CF9',
          'purple-light': '#5B68FA',
          'purple-bg': '#EEF0FF',
          panel: '#F7F7F4',
          border: '#E7E7E3',
          text: '#22232A',
          muted: '#6B6D76',
          green: '#1D9E75',
          red: '#E24B4A',
        },
      },
      screens: {
        'desktop-sm': '1024px',
        'desktop-md': '1280px',
        'desktop-lg': '1536px',
      },
    },
  },
  plugins: [],
}


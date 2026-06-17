/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        cyber: {
          dark: '#1a1a2e',
          purple: '#16213e',
          pink: '#ff2e63',
          cyan: '#08d9d6',
          yellow: '#f9ed69',
        }
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        noto: ['Noto Sans SC', 'sans-serif'],
      },
      boxShadow: {
        'neon-pink': '0 0 5px #ff2e63, 0 0 20px #ff2e6380',
        'neon-cyan': '0 0 5px #08d9d6, 0 0 20px #08d9d680',
      },
      animation: {
        'danmu': 'danmu 8s linear forwards',
        'float': 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        danmu: {
          '0%': { transform: 'translateX(100vw)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
      },
    },
  },
  plugins: [],
};

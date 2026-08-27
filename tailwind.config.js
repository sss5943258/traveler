/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        esence: {
          brown: '#583f24', // Deep Earthy Brown (Primary accent)
          gold: '#9e7a4e',  // Soft Camel/Gold (Secondary hover)
          cream: '#FAF8F5', // Warm Ivory (Background base)
          dark: '#2C2A29',  // Sophisticated Charcoal (Text primary)
          sand: '#E6E1DA',  // Light Sand (Borders / dividers)
          beige: '#F0EDE9', // Light Beige (Secondary background elements)
        },
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', 'system-ui', 'sans-serif'],
        serif: ['"Noto Serif TC"', 'Georgia', 'serif'],
      },
      boxShadow: {
        fine: '0 4px 20px rgba(88, 63, 36, 0.04)',
        premium: '0 10px 40px rgba(88, 63, 36, 0.08)',
        modal: '0 20px 50px rgba(44, 42, 41, 0.15)',
      },
      animation: {
        'modal-in': 'modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-up': 'fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
      },
      keyframes: {
        modalIn: {
          from: { opacity: '0', transform: 'scale(0.98) translateY(10px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(15px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

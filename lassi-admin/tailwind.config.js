/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Design system LASSİ
        bg:      '#14152A',
        surface: '#1E2040',
        border:  '#2A2C52',
        accent:  '#FDCF34',
        muted:   '#9A9BB0',
        success: '#5FD38A',
        orange:  '#F0A847',
        danger:  '#E07A7A',
      },
      fontFamily: {
        sans:  ['"Plus Jakarta Sans"', 'sans-serif'],
        title: ['Poppins', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '11px',
        lg:      '16px',
        xl:      '22px',
      },
    },
  },
  plugins: [],
}

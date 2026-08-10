/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: '#16a34a',   // Forest Green from app icon
        'primary-light': '#dcfce7',
        'primary-dark': '#15803d',
        surface: '#ffffff',
        background: '#f9fafb',
        'text-primary': '#111827',
        'text-secondary': '#6b7280',
        'text-muted': '#9ca3af',
        border: '#f3f4f6',
        'border-subtle': '#e5e7eb',
        // Platform badge colors
        youtube: '#FF0000',
        twitter: '#000000',
        article: '#6b7280',
      },
    },
  },
  plugins: [],
}

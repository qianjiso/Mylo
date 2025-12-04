const path = require('path');

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  devtool: isProd ? false : 'source-map',
  entry: {
    main: './src/main/main.ts',
    preload: './src/main/preload.ts'
  },
  target: 'electron-main',
  output: {
    path: path.resolve(__dirname, 'dist/main'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true
          }
        },
        exclude: /node_modules/,
      },
    ],
  },
  externals: {
    electron: 'commonjs2 electron',
    'better-sqlite3': 'commonjs better-sqlite3'
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  node: {
    __dirname: false,
    __filename: false,
  },
};

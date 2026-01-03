const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const WorkboxWebpackPlugin = require('workbox-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const CircularDependencyPlugin = require('circular-dependency-plugin');
const Dotenv = require('dotenv-webpack');
const process = require('process');
const fs = require('fs');
const CopyPlugin = require('copy-webpack-plugin');

require('dotenv').config({
  path: path.resolve(__dirname, '.env'),
});

const icons = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'public/inline-icons.svg')
);

const REPO_NAME = 'icbm-missile-simulator';

const config = {
  entry: {
    app: './src/index',
  },
  output: {
    path: path.resolve(__dirname, '../dist'),
    filename: '[name].[chunkhash].js',
  },
  plugins: [
    new CleanWebpackPlugin(),
    new CircularDependencyPlugin({
      failOnError: false,
      allowAsyncCycles: false,
      cwd: process.cwd(),
    }),
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: 'ts-loader',
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: 'icons',
            },
          },
        ],
      },
      {
        test: /\.(obj)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: 'models',
            },
          },
        ],
      },
      {
        test: /\.svg$/,
        use: ['@svgr/webpack'],
      },
      {
        test: /manifest\.json$/,
        type: 'javascript/auto',
        loader: 'file-loader',
        options: {
          name: '[name].[ext]',
          outputPath: '',
        },
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    plugins: [new TsconfigPathsPlugin({ configFile: './tsconfig.json' })],
  },
  devServer: {
    static: path.resolve(__dirname, '../dist'),
    historyApiFallback: true,
    open: true,
    hot: true,
    port: 3000,
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
};

module.exports = (env, argv) => {
  const {
    module: { rules },
    plugins,
  } = config;

  plugins.push(
    new CopyPlugin({
      patterns: [
        { from: "src/public/robots.txt", to: "robots.txt" },
        { from: "src/public/sitemap.xml", to: "sitemap.xml" },
        { from: "preview.png", to: "preview.png" },
        { from: "src/public/sound", to: "sound" },
      ],
    }),
  );

  if (argv.mode === 'production') {
    config.mode = 'production';

    rules.push({
      test: /\.css$/,
      use: [MiniCssExtractPlugin.loader, 'css-loader'],
    });
    
    config.output.publicPath = `/${REPO_NAME}/`;

    plugins.push(
      new MiniCssExtractPlugin({
        filename: '[name].[chunkhash].css',
      }),
      new HtmlWebpackPlugin({
        title: '',
        svgIcons: icons,
        template: './src/public/index.html',
        minify: {
          collapseWhitespace: true,
          removeComments: true,
          removeRedundantAttributes: true,
          useShortDoctype: true,
          removeEmptyAttributes: true,
          removeStyleLinkTypeAttributes: true,
          keepClosingSlash: true,
          minifyJS: true,
          minifyCSS: true,
          minifyURLs: true,
        },
      }),
      new Dotenv({
        path: `./config/.env`,
        systemvars: true,
      })
    );

    rules.push(
      {
        test: /\.(css|scss)$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              esModule: false,
              modules: {
                namedExport: false,
                localIdentName: '[local]__[hash:base64:5]',
                // mode: 'local',
              },
            },
          },
          'sass-loader',
        ],
        include: /\.(module\.css|module\.scss)$/,
      },
      {
        test: /\.(css|scss)$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
        exclude: /\.(module\.css|module\.scss)$/,
      }
    );

    // plugins.push(new WorkboxWebpackPlugin.GenerateSW());

    return config;
  }

  config.devtool = 'source-map';
  config.mode = 'development';

  if (Number(process.env.ENABLE_BASE_API_PROXY)) {
    config.devServer.proxy = [
      {
        context: [process.env.BASE_API_PATH], // Specify which paths to proxy
        target: process.env.BASE_API_URL, // Specify the target host
        changeOrigin: true, // Adjusts the origin of the host header to the target URL
        secure: false, // Disable SSL verification if your API uses self-signed certificates
      },
    ];
  }

  plugins.push(
    new HtmlWebpackPlugin({
      title: '',
      svgIcons: icons,
      template: './src/public/index.html',
    }),
    new Dotenv({
      path: `./config/.env.dev`,
    })
  );

  rules.push(
    {
      test: /\.(css|scss)$/,
      use: [
        'style-loader',
        {
          loader: 'css-loader',
          options: {
            esModule: false,
            modules: {
              namedExport: false,
              localIdentName: '[local]__[hash:base64:5]',
            },
          },
        },
        'sass-loader',
      ],
      include: /\.(module\.css|module\.scss)$/,
    },
    {
      test: /\.(css|scss)$/,
      use: ['style-loader', 'css-loader', 'sass-loader'],
      exclude: /\.(module\.css|module\.scss)$/,
    }
  );

  return config;
};

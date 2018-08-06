前端代码是官网直接下载的，为了便于项目管理，做了反打包（debundle）处理，使用[Create React App](https://github.com/facebookincubator/create-react-app)做项目构建。

## 安装依赖 
```js
$ yarn install
```

## 开发环境运行
```js
$ yarn start
```

## 打包
```js
$ yarn build
```

## 服务器运行单页面
对于打包后的前端代码，服务器服务需要做单页面配置，如果是为了演示学习目的，可以安装serve来实现支持单页面的服务。
```js
$ yarn global add serve
// or
$ npm install -g serve
```
最新的serve对node版本要求是8.x，如果你的node低于8.x，请升级node到8.x版本。

```shell
$ curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
$ sudo apt install -y nodejs
```

## 运行
```js
$ serve ./build -l tcp://0.0.0.0:8000 -s
```

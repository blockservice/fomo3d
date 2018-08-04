# fomo大全

- `sols`是合约部分， 内有简单使用说明

- `www`是前端部分，大部分代码已格式化，

    本工程是react项目，需要懂些nodejs的知识，上线所需：

        修改`src/entry.js`里的节点（替换10.0.21.112 IP）和合约地址信息

        替换`src/JUST.js`里的synchronizeTime部分，填写自己的后台服务地址

        需要`yarn install && yarn build`后，在`build`目录下得到静态文件

    推荐使用node生态里的 `serve`，作为webserve把前端跑起来
    ```
    cd build &&  serve . -l tcp://0.0.0.0:8000 -s
    ```

- `timenow`是前端依赖的后台服务，对应的.go文件是源码

    ```
    cp timenow.go $GOPATH/src && go run timenow.go
    ```

#### note

希望有人能出更详尽的教程... 写的太糙了
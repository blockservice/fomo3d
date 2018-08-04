package main

import (
	"flag"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

var (

	// ServerMode ServerMode
	ServerMode = flag.String("m", "release", "server listen port")
	// ServerPort server port
	ServerPort = flag.String("p", "3001", "server listen port")
)

// Cors Cors
func Cors() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(200)
		} else {
			c.Next()
		}
	}
}

func main() {

	gin.SetMode(*ServerMode)

	router := gin.Default()

	// Set a lower memory limit for multipart forms (default is 32 MiB)
	// router.MaxMultipartMemory = 8 << 20 // 8 MiB
	router.MaxMultipartMemory = 64 << 20 // 64 MiB

	router.Use(Cors())

	/* api base */
	r0 := router.Group("/")
	{
		r0.GET("", Index)
		r0.GET("health", Health)
	}

	rfomo3d := router.Group("/api")
	{
		rfomo3d.GET("/timenow", GetTimeNow)
	}

	server := &http.Server{
		Addr:         ":" + *ServerPort,
		Handler:      router,
		ReadTimeout:  300 * time.Second,
		WriteTimeout: 300 * time.Second,
	}

	server.ListenAndServe()
}

// Index Index
func Index(c *gin.Context) {
	c.String(http.StatusOK, "eth-server index")
}

// Health Health
func Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "UP"})
}

// GetTimeNow GetTimeNow
func GetTimeNow(c *gin.Context) {

	_timeNow := time.Now().UnixNano() / 1e6

	c.JSON(http.StatusOK, gin.H{"now": _timeNow})
}

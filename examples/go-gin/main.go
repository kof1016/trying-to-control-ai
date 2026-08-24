package main

import (
	"log"
	"math/big"
	"net/http"

	"github.com/gin-gonic/gin"
)

func newRouter() *gin.Engine {
	router := gin.New()
	router.GET("/add", func(context *gin.Context) {
		a, validA := new(big.Int).SetString(context.Query("a"), 10)
		b, validB := new(big.Int).SetString(context.Query("b"), 10)
		if !validA || !validB {
			context.Status(http.StatusBadRequest)
			return
		}
		context.JSON(http.StatusOK, gin.H{"result": new(big.Int).Add(a, b).String()})
	})
	return router
}

func main() {
	if err := newRouter().Run(); err != nil {
		log.Fatal(err)
	}
}

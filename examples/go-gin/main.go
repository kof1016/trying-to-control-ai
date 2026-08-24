package main

import (
	"log"
	"math/big"
	"net/http"

	"github.com/gin-gonic/gin"
)

const maxOperandDigits = 1000

func parseOperand(value string) (*big.Int, bool) {
	digits := value
	if len(digits) > 0 && (digits[0] == '+' || digits[0] == '-') {
		digits = digits[1:]
	}
	if len(digits) > maxOperandDigits {
		return nil, false
	}
	return new(big.Int).SetString(value, 10)
}

func newRouter() *gin.Engine {
	router := gin.New()
	router.GET("/add", func(context *gin.Context) {
		a, validA := parseOperand(context.Query("a"))
		b, validB := parseOperand(context.Query("b"))
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

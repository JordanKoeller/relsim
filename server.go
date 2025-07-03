package main

import (
	"log"
	"net/http"
)

func main() {
  // mux := http.NewServeMux()
 // mux.Handle("/static", http.FileServer(http.Dir("static")))
  //mux.Handle("/obj", http.FileServer(http.Dir("obj")))

	s := http.Server{
		Addr:    ":3000",
		Handler: http.FileServer(http.Dir("dist")),
	}

  log.Printf("Starting server on http://localhost%s", s.Addr)
  log.Fatalf("Server Error: %v", s.ListenAndServe())
}


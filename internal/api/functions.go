package api

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// CreateFunctionRequest represents a request to create a function
type CreateFunctionRequest struct {
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description"`
	SourceCode  string   `json:"source_code" binding:"required"`
	Timeout     int      `json:"timeout,omitempty"`
	Memory      int      `json:"memory,omitempty"`
	Secrets     []string `json:"secrets,omitempty"`
}

// UpdateFunctionRequest represents a request to update a function
type UpdateFunctionRequest struct {
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description"`
	SourceCode  string   `json:"source_code" binding:"required"`
	Timeout     int      `json:"timeout,omitempty"`
	Memory      int      `json:"memory,omitempty"`
	Secrets     []string `json:"secrets,omitempty"`
}

// ExecuteFunctionRequest represents a request to execute a function
type ExecuteFunctionRequest struct {
	Params interface{} `json:"params"`
	Async  bool        `json:"async"`
}

// listFunctionsHandler handles function listing
func (s *Server) listFunctionsHandler(c *gin.Context) {
	// Get user ID from context
	userID, err := GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Parse pagination parameters
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		page = 1
	}

	limit, err := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if err != nil || limit < 1 || limit > 100 {
		limit = 20
	}

	// Get functions
	functions, err := s.functionService.ListFunctions(userID, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to list functions: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    functions,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			// TODO: Add total count
		},
	})
}

// getFunctionHandler handles function retrieval
func (s *Server) getFunctionHandler(c *gin.Context) {
	// Get user ID from context
	userID, err := GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Parse function ID
	functionID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid function ID"})
		return
	}

	// Get function
	function, err := s.functionService.GetFunction(functionID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to get function: " + err.Error()})
		return
	}

	if function == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Function not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": function})
}

// createFunctionHandler handles function creation
func (s *Server) createFunctionHandler(c *gin.Context) {
	// Get user ID from context
	userID, err := GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Parse request
	var req CreateFunctionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request: " + err.Error()})
		return
	}

	// Create function
	function, err := s.functionService.CreateFunction(
		userID,
		req.Name,
		req.Description,
		req.SourceCode,
		req.Timeout,
		req.Memory,
		req.Secrets,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to create function: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": function})
}

// updateFunctionHandler handles function updates
func (s *Server) updateFunctionHandler(c *gin.Context) {
	// Get user ID from context
	userID, err := GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Parse function ID
	functionID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid function ID"})
		return
	}

	// Parse request
	var req UpdateFunctionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request: " + err.Error()})
		return
	}

	// Update function
	function, err := s.functionService.UpdateFunction(
		functionID,
		userID,
		req.Name,
		req.Description,
		req.SourceCode,
		req.Timeout,
		req.Memory,
		req.Secrets,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to update function: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": function})
}

// deleteFunctionHandler handles function deletion
func (s *Server) deleteFunctionHandler(c *gin.Context) {
	// Get user ID from context
	userID, err := GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Parse function ID
	functionID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid function ID"})
		return
	}

	// Delete function
	err = s.functionService.DeleteFunction(functionID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to delete function: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"id": functionID, "deleted": true}})
}

// executeFunctionHandler handles function execution
func (s *Server) executeFunctionHandler(c *gin.Context) {
	// Get user ID from context
	userID, err := GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Parse function ID
	functionID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid function ID"})
		return
	}

	// Parse request
	var req ExecuteFunctionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request: " + err.Error()})
		return
	}

	// Convert params to map if needed
	paramsMap := make(map[string]interface{})
	if req.Params != nil {
		// If params is already a map, use it directly
		if paramsAsMap, ok := req.Params.(map[string]interface{}); ok {
			paramsMap = paramsAsMap
		} else {
			// Otherwise, try to convert it
			paramsMap["data"] = req.Params
		}
	}

	// Execute function
	result, err := s.functionService.ExecuteFunction(c.Request.Context(), functionID, userID, paramsMap, req.Async)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to execute function: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
}

// getFunctionExecutionHandler gets execution details
func (s *Server) getFunctionExecutionHandler(c *gin.Context) {
	// Get user ID from context
	userID, err := GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Get execution ID
	executionID := c.Param("execution_id")
	if executionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Execution ID is required"})
		return
	}

	// Get execution
	execution, err := s.functionService.GetExecution(executionID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to get execution: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": execution})
}

// getFunctionExecutionsHandler lists executions
func (s *Server) getFunctionExecutionsHandler(c *gin.Context) {
	// Get user ID from context
	userID, err := GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Parse function ID
	functionID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid function ID"})
		return
	}

	// Parse pagination parameters
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		page = 1
	}

	limit, err := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if err != nil || limit < 1 || limit > 100 {
		limit = 20
	}

	// Get executions
	executions, err := s.functionService.ListExecutions(functionID, userID, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to list executions: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    executions,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			// TODO: Add total count
		},
	})
}

// getFunctionLogsHandler gets function logs
func (s *Server) getFunctionLogsHandler(c *gin.Context) {
	// TODO: Implement this
	c.JSON(http.StatusNotImplemented, gin.H{"success": false, "error": "Not implemented yet"})
}

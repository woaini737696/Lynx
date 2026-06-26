package com.lynnhub.app.data.remote

import com.lynnhub.app.data.remote.dto.*
import retrofit2.http.*

/**
 * 后端 API 接口定义
 * 对应 Next.js 后端 /api 路由
 */
interface ApiService {

    // ============ Auth ============
    @POST("api/auth/token")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    // ============ Health ============
    @GET("api/health")
    suspend fun health(): HealthResponse

    @GET("api/health/mobile")
    suspend fun mobileConfig(): MobileConfigResponse

    // ============ Focus ============
    @GET("api/focus")
    suspend fun getFocus(): FocusResponse

    @PATCH("api/focus/{id}")
    suspend fun patchFocus(
        @Path("id") id: String,
        @Body body: FocusPatchRequest
    ): SuccessResponse

    // ============ Tasks (看板) ============
    @GET("api/tasks")
    suspend fun getTasks(): List<TaskDto>

    @POST("api/tasks")
    suspend fun createTask(@Body body: TaskCreateRequest): TaskDto

    @PATCH("api/tasks/{id}")
    suspend fun patchTask(
        @Path("id") id: String,
        @Body body: TaskPatchRequest
    ): TaskDto

    @DELETE("api/tasks/{id}")
    suspend fun deleteTask(@Path("id") id: String): SuccessResponse

    @GET("api/tasks/stats")
    suspend fun getTaskStats(): TaskStatsDto

    // ============ Ideas (灵感) ============
    @GET("api/ideas")
    suspend fun getIdeas(): IdeasResponse

    @POST("api/ideas")
    suspend fun createIdea(@Body body: IdeaCreateRequest): SuccessResponse

    @PATCH("api/ideas/{id}")
    suspend fun patchIdea(
        @Path("id") id: String,
        @Body body: IdeaActionRequest
    ): SuccessResponse

    @HTTP(method = "DELETE", path = "api/ideas", hasBody = true)
    suspend fun deleteIdeas(@Body body: IdeaDeleteRequest): SuccessResponse

    // ============ Lark Tasks (飞书任务) ============
    @GET("api/lark-tasks")
    suspend fun getLarkTasks(
        @Query("view") view: String = "my",
        @Query("complete") complete: Boolean? = null,
        @Query("db_only") dbOnly: Boolean = true
    ): LarkTasksResponse

    @GET("api/lark-tasks/{id}")
    suspend fun getLarkTask(
        @Path("id") id: String,
        @Query("db_only") dbOnly: Boolean = true
    ): LarkTaskDetailResponse

    @PATCH("api/lark-tasks/{id}")
    suspend fun toggleLarkTask(
        @Path("id") id: String,
        @Body body: LarkTaskToggleRequest
    ): SuccessResponse

    @GET("api/lark-tasks/sync")
    suspend fun getSyncState(): SyncResponse

    @POST("api/lark-tasks/sync")
    suspend fun triggerSync(): SyncResponse

    // ============ AI Chat ============
    @GET("api/ai/chat/sessions")
    suspend fun getChatSessions(): ChatSessionsResponse

    @POST("api/ai/chat/sessions")
    suspend fun createChatSession(@Body body: ChatCreateSessionRequest): ChatSessionDto

    @PUT("api/ai/chat/sessions/{id}")
    suspend fun updateChatSession(
        @Path("id") id: String,
        @Body body: ChatCreateSessionRequest
    ): ChatSessionDto

    @DELETE("api/ai/chat/sessions/{id}")
    suspend fun deleteChatSession(@Path("id") id: String): SuccessResponse

    @GET("api/ai/chat/sessions/{id}/messages")
    suspend fun getChatMessages(@Path("id") id: String): ChatMessagesResponse

    @POST("api/ai/chat")
    suspend fun sendChat(@Body body: ChatSendRequest): ChatResponse

    @GET("api/ai/models")
    suspend fun getAiModels(): AiModelsResponse

    // ============ AI Settings ============
    @GET("api/ai/settings")
    suspend fun getAiSettings(): AiSettingsDto

    @PUT("api/ai/settings")
    suspend fun updateAiSettings(@Body body: AiSettingsDto): SuccessResponse

    // ============ Memory ============
    @GET("api/memory")
    suspend fun getMemory(): MemoryResponse

    @GET("api/memory/search")
    suspend fun searchMemory(@Query("q") query: String): MemorySearchResponse

    // ============ Cognitions ============
    @GET("api/cognitions")
    suspend fun getCognitions(): CognitionsResponse

    // ============ Hermes Agent ============
    @GET("api/hermes/status")
    suspend fun getHermesStatus(): HermesStatusResponse

    @POST("api/hermes/install")
    suspend fun hermesInstall(@Body body: HermesInstallRequest): HermesInstallResponse

    @POST("api/hermes/test")
    suspend fun hermesTest(@Body body: HermesTestRequest): HermesTestResponse

    @POST("api/hermes/execute")
    suspend fun hermesExecute(@Body body: HermesExecuteRequest): HermesExecuteResponse

    @GET("api/hermes/skills")
    suspend fun getHermesSkills(@Query("category") category: String? = null): HermesSkillsResponse

    @POST("api/hermes/skills/preload")
    suspend fun hermesPreloadSkills(): HermesPreloadResponse

    @GET("api/hermes/patterns")
    suspend fun getHermesPatterns(
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 50
    ): HermesPatternsResponse

    @PATCH("api/hermes/patterns/{id}")
    suspend fun patchHermesPattern(
        @Path("id") id: String,
        @Body body: HermesPatternPatchRequest
    ): SuccessResponse

    @DELETE("api/hermes/patterns/{id}")
    suspend fun deleteHermesPattern(@Path("id") id: String): SuccessResponse

    @POST("api/hermes/patterns/auto-check")
    suspend fun hermesPatternAutoCheck(@Body body: HermesPatternAutoCheckRequest): HermesPatternAutoCheckResponse

    @GET("api/hermes/reports")
    suspend fun getHermesReports(
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 20
    ): HermesReportsResponse

    @POST("api/hermes/proactive-report")
    suspend fun triggerHermesReport(@Body body: HermesReportRequest): HermesReportResponse

    @GET("api/hermes/memory/search")
    suspend fun searchHermesMemory(@Query("q") query: String): HermesMemorySearchResponse

    @GET("api/hermes/profile")
    suspend fun getHermesProfile(): HermesProfileResponse
}

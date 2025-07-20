# ReportingService Refactor - Architectural Plan

## Current State Analysis

### Current Problems with ReportingService (1,208 lines)

1. **Violation of Single Responsibility Principle**

   - Handles both whisper reports AND comment reports
   - Contains report creation, escalation, resolution, and statistics
   - Mixes business logic with data access patterns
   - Contains complex escalation algorithms

2. **Code Duplication**

   - Similar logic for whisper and comment reports
   - Duplicate escalation and resolution patterns
   - Repeated priority calculation logic

3. **Complex Dependencies**

   - Depends on multiple services (Privacy, Reputation, Suspension, Firestore)
   - Tight coupling between different report types
   - Hard to test individual components

4. **Maintainability Issues**
   - Large file with multiple responsibilities
   - Complex escalation logic mixed with basic CRUD
   - Difficult to modify one report type without affecting the other

## Proposed Solution: Microservices Architecture

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Reporting Domain                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ WhisperReport   │  │ CommentReport   │  │ ReportEscalation│  │
│  │ Service         │  │ Service         │  │ Service         │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│           │                    │                    │            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ WhisperReport   │  │ CommentReport   │  │ Escalation      │  │
│  │ Repository      │  │ Repository      │  │ Repository      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                    Shared Infrastructure                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ ReportPriority  │  │ ReportResolution│  │ ReportAnalytics │  │
│  │ Service         │  │ Service         │  │ Service         │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│           │                    │                    │            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Priority        │  │ Resolution      │  │ Analytics       │  │
│  │ Repository      │  │ Repository      │  │ Repository      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Service Breakdown Strategy

### 1. Core Report Services

#### 1.1 WhisperReportService (200-250 lines)

**Responsibilities:**

- Create whisper reports
- Get whisper reports with filtering
- Update whisper report status
- Check if user has reported whisper
- Get whisper report statistics

**Methods:**

```typescript
class WhisperReportService {
  async createReport(data: CreateWhisperReportData): Promise<WhisperReport>;
  async getReports(filters: WhisperReportFilters): Promise<WhisperReport[]>;
  async getReport(reportId: string): Promise<WhisperReport | null>;
  async updateStatus(reportId: string, status: ReportStatus): Promise<void>;
  async hasUserReported(whisperId: string, userId: string): Promise<boolean>;
  async getWhisperStats(whisperId: string): Promise<WhisperReportStats>;
}
```

#### 1.2 CommentReportService (200-250 lines)

**Responsibilities:**

- Create comment reports
- Get comment reports with filtering
- Update comment report status
- Check if user has reported comment
- Get comment report statistics

**Methods:**

```typescript
class CommentReportService {
  async createReport(data: CreateCommentReportData): Promise<CommentReport>;
  async getReports(filters: CommentReportFilters): Promise<CommentReport[]>;
  async getReport(reportId: string): Promise<CommentReport | null>;
  async updateStatus(reportId: string, status: ReportStatus): Promise<void>;
  async hasUserReported(commentId: string, userId: string): Promise<boolean>;
  async getCommentStats(commentId: string): Promise<CommentReportStats>;
}
```

### 2. Shared Infrastructure Services

#### 2.1 ReportPriorityService (150-200 lines)

**Responsibilities:**

- Calculate report priority based on reporter reputation
- Calculate reputation weight multipliers
- Handle priority escalation logic
- Provide priority-based filtering

**Methods:**

```typescript
class ReportPriorityService {
  calculatePriority(
    reporterReputation: UserReputation,
    category: ReportCategory
  ): ReportPriority;
  calculateReputationWeight(reporterReputation: UserReputation): number;
  escalatePriority(currentPriority: ReportPriority): ReportPriority;
  getPriorityThresholds(): PriorityThresholds;
  shouldEscalate(priority: ReportPriority, reportCount: number): boolean;
}
```

#### 2.2 ReportResolutionService (300-350 lines)

**Responsibilities:**

- Apply report resolutions (warn, flag, reject, ban)
- Handle content moderation actions
- Manage user suspensions and bans
- Track resolution history

**Methods:**

```typescript
class ReportResolutionService {
  async resolveWhisperReport(
    reportId: string,
    resolution: WhisperReportResolution
  ): Promise<void>;
  async resolveCommentReport(
    reportId: string,
    resolution: CommentReportResolution
  ): Promise<void>;
  private async applyWhisperResolution(
    whisperId: string,
    resolution: WhisperReportResolution
  ): Promise<void>;
  private async applyCommentResolution(
    commentId: string,
    resolution: CommentReportResolution
  ): Promise<void>;
  private async sendWarning(userId: string, reason: string): Promise<void>;
  private async flagContent(contentId: string, reason: string): Promise<void>;
  private async rejectContent(contentId: string, reason: string): Promise<void>;
  private async banUser(userId: string, reason: string): Promise<void>;
}
```

#### 2.3 ReportEscalationService (200-250 lines)

**Responsibilities:**

- Handle automatic escalation based on report count
- Manage escalation thresholds and rules
- Trigger immediate review for critical reports
- Handle user-level escalation

**Methods:**

```typescript
class ReportEscalationService {
  async checkAutomaticEscalation(
    contentId: string,
    contentType: "whisper" | "comment"
  ): Promise<void>;
  async escalateReport(reportId: string): Promise<void>;
  async checkUserLevelEscalation(userId: string): Promise<void>;
  private async shouldEscalateContent(
    contentId: string,
    contentType: "whisper" | "comment"
  ): Promise<boolean>;
  private async getEscalationThresholds(): Promise<EscalationThresholds>;
}
```

#### 2.4 ReportAnalyticsService (150-200 lines)

**Responsibilities:**

- Generate report statistics and analytics
- Provide reporting insights
- Track report trends
- Generate admin dashboards

**Methods:**

```typescript
class ReportAnalyticsService {
  async getOverallStats(): Promise<OverallReportStats>;
  async getWhisperReportStats(whisperId: string): Promise<WhisperReportStats>;
  async getCommentReportStats(commentId: string): Promise<CommentReportStats>;
  async getUserReportStats(userId: string): Promise<UserReportStats>;
  async getCategoryBreakdown(): Promise<CategoryBreakdown>;
  async getPriorityBreakdown(): Promise<PriorityBreakdown>;
}
```

### 3. Repository Layer

#### 3.1 WhisperReportRepository

```typescript
interface WhisperReportRepository {
  save(report: WhisperReport): Promise<void>;
  getById(id: string): Promise<WhisperReport | null>;
  getWithFilters(filters: WhisperReportFilters): Promise<WhisperReport[]>;
  update(id: string, updates: Partial<WhisperReport>): Promise<void>;
  delete(id: string): Promise<void>;
  getByWhisper(whisperId: string): Promise<WhisperReport[]>;
  getByReporter(reporterId: string): Promise<WhisperReport[]>;
}
```

#### 3.2 CommentReportRepository

```typescript
interface CommentReportRepository {
  save(report: CommentReport): Promise<void>;
  getById(id: string): Promise<CommentReport | null>;
  getWithFilters(filters: CommentReportFilters): Promise<CommentReport[]>;
  update(id: string, updates: Partial<CommentReport>): Promise<void>;
  delete(id: string): Promise<void>;
  getByComment(commentId: string): Promise<CommentReport[]>;
  getByReporter(reporterId: string): Promise<CommentReport[]>;
}
```

#### 3.3 Shared Repositories

- `ReportPriorityRepository` - Store priority calculations and thresholds
- `ReportResolutionRepository` - Store resolution history and actions
- `ReportEscalationRepository` - Store escalation rules and triggers
- `ReportAnalyticsRepository` - Store analytics data and metrics

## Implementation Plan

### Phase 1: Create Infrastructure Services (Week 1) ✅ COMPLETED

1. **Create ReportPriorityService** ✅

   - Extract priority calculation logic
   - Create priority repository
   - Add comprehensive tests (31 tests passing)

2. **Create ReportAnalyticsService** ✅
   - Extract statistics generation logic
   - Create analytics repository
   - Add comprehensive tests (16 tests passing)

### Phase 2: Create Core Report Services (Week 2)

3. **Create WhisperReportService**

   - Extract whisper-specific logic
   - Create whisper report repository
   - Add comprehensive tests

4. **Create CommentReportService**
   - Extract comment-specific logic
   - Create comment report repository
   - Add comprehensive tests

### Phase 3: Create Resolution and Escalation Services (Week 3)

5. **Create ReportResolutionService**

   - Extract resolution logic
   - Create resolution repository
   - Add comprehensive tests

6. **Create ReportEscalationService**
   - Extract escalation logic
   - Create escalation repository
   - Add comprehensive tests

### Phase 4: Migration and Cleanup (Week 4)

7. **Update Existing Code**

   - Update all imports and references
   - Migrate existing functionality
   - Ensure backward compatibility

8. **Remove Old ReportingService**
   - Remove the old service
   - Clean up unused code
   - Update documentation

## Benefits of This Architecture

### 1. **Single Responsibility Principle**

- Each service has one clear purpose
- Easy to understand and maintain
- Clear boundaries between concerns

### 2. **Improved Testability**

- Each service can be tested in isolation
- Smaller, focused test suites
- Easier to mock dependencies

### 3. **Better Maintainability**

- Changes to one report type don't affect the other
- Easier to add new features
- Clear separation of concerns

### 4. **Enhanced Scalability**

- Services can be scaled independently
- Easy to add new report types
- Better performance through focused caching

### 5. **Reduced Complexity**

- Smaller, more focused files
- Easier to understand and debug
- Better code organization

## Risk Mitigation

### 1. **Backward Compatibility**

- Maintain existing public APIs during transition
- Gradual migration approach
- Comprehensive testing at each step

### 2. **Performance Impact**

- Monitor performance metrics
- Optimize database queries
- Implement efficient caching strategies

### 3. **Breaking Changes**

- Maintain existing interfaces
- Use dependency injection for flexibility
- Comprehensive integration testing

## Success Criteria

1. **All existing functionality preserved**
2. **Improved test coverage (>90%)**
3. **Reduced file sizes (<300 lines per service)**
4. **Clear separation of concerns**
5. **Better maintainability metrics**
6. **No performance regression**

## Timeline Estimate

- **Phase 1**: 1 week (Infrastructure services)
- **Phase 2**: 1 week (Core report services)
- **Phase 3**: 1 week (Resolution and escalation)
- **Phase 4**: 1 week (Migration and cleanup)

**Total**: 4 weeks

## Next Steps

1. **Review and approve this plan**
2. **Start with Phase 1** (ReportPriorityService)
3. **Implement incrementally** with thorough testing
4. **Monitor for issues** and adjust as needed
5. **Document lessons learned** for future refactors

This refactor will transform the monolithic ReportingService into a well-architected, maintainable, and scalable system that follows clean architecture principles.

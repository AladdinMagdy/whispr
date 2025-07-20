# Phase 7: FirestoreService Refactor - Architectural Plan

## Current State Analysis

### Current Architecture Problems

1. **Violation of Single Responsibility Principle**

   - `FirestoreService` contains 3000+ lines with methods for:
     - Whisper operations (core functionality)
     - Comment operations (core functionality)
     - Like operations (core functionality)
     - Appeal operations (domain-specific)
     - Report operations (domain-specific)
     - Suspension operations (domain-specific)
     - User Block/Mute/Restriction operations (domain-specific)
     - Reputation operations (domain-specific)

2. **Tight Coupling**

   - All services depend on `FirestoreService` for their domain operations
   - Services are tightly coupled to Firebase implementation details
   - Hard to test individual services in isolation

3. **Code Duplication**

   - Similar CRUD patterns repeated across services
   - Error handling and validation logic duplicated
   - Data transformation logic scattered

4. **Testing Complexity**
   - Each service requires extensive `FirestoreService` mocking
   - Unit tests become integration tests
   - Mock setup is complex and brittle

## Proposed Solution: Repository Pattern

### Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Services      │    │   Repositories  │    │   Firebase SDK  │
│                 │    │                 │    │                 │
│ AppealService   │───▶│ AppealRepo      │───▶│ Firestore       │
│ ReportingService│───▶│ ReportRepo      │───▶│ Storage         │
│ SuspensionService│───▶│ SuspensionRepo  │───▶│ Auth            │
│ UserBlockService│───▶│ UserBlockRepo   │───▶│                 │
│ ReputationService│───▶│ ReputationRepo  │───▶│                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Repository Pattern Benefits

1. **Separation of Concerns**

   - Services focus on business logic
   - Repositories handle data access
   - Clear boundaries between layers

2. **Testability**

   - Easy to mock repositories
   - Services can be tested in isolation
   - Clear contracts through interfaces

3. **Flexibility**

   - Easy to add caching layers
   - Can switch database providers
   - Can add validation or transformation layers

4. **Maintainability**
   - Single responsibility per repository
   - Consistent error handling
   - Centralized data access patterns

## Implementation Plan

### Phase 7A: Create Repository Interfaces

1. **Define Repository Interfaces**

   ```typescript
   interface AppealRepository {
     getAll(): Promise<Appeal[]>;
     getById(id: string): Promise<Appeal | null>;
     save(appeal: Appeal): Promise<void>;
     update(id: string, updates: Partial<Appeal>): Promise<void>;
     getByUser(userId: string): Promise<Appeal[]>;
     getPending(): Promise<Appeal[]>;
   }
   ```

2. **Create Repository Interfaces for Each Domain**
   - `AppealRepository`
   - `ReportRepository`
   - `SuspensionRepository`
   - `UserBlockRepository`
   - `UserMuteRepository`
   - `UserRestrictionRepository`
   - `ReputationRepository`

### Phase 7B: Implement Firebase Repositories

1. **Create Firebase Repository Implementations**

   ```typescript
   class FirebaseAppealRepository implements AppealRepository {
     private firestore = getFirestoreInstance();
     private collection = "appeals";

     async getAll(): Promise<Appeal[]> {
       const snapshot = await this.firestore.collection(this.collection).get();
       return snapshot.docs.map(
         (doc) => ({ id: doc.id, ...doc.data() } as Appeal)
       );
     }
     // ... other methods
   }
   ```

2. **Implement All Repository Methods**
   - Direct Firebase SDK usage
   - Proper error handling
   - Data transformation
   - Type safety

### Phase 7C: Update Services to Use Repositories

1. **Update Service Constructors**

   ```typescript
   class AppealService {
     private repository: AppealRepository;

     constructor(repository?: AppealRepository) {
       this.repository = repository || new FirebaseAppealRepository();
     }
   }
   ```

2. **Replace FirestoreService Calls**
   - Remove `getFirestoreService()` dependencies
   - Use repository methods instead
   - Maintain same public API

### Phase 7D: Clean Up FirestoreService

1. **Remove Domain-Specific Methods**

   - Remove appeal methods
   - Remove report methods
   - Remove suspension methods
   - Remove user block/mute/restriction methods
   - Remove reputation methods

2. **Keep Core Methods**
   - Whisper operations (create, read, update, delete)
   - Comment operations
   - Like operations
   - Basic user reputation operations (for core functionality)

### Phase 7E: Update Tests

1. **Update Service Tests**

   - Mock repositories instead of FirestoreService
   - Test business logic in isolation
   - Verify repository method calls

2. **Create Repository Tests**
   - Test Firebase repository implementations
   - Test error handling
   - Test data transformation

## Migration Strategy

### Step-by-Step Approach

1. **Start with AppealService** (simplest domain)

   - Create `AppealRepository` interface
   - Implement `FirebaseAppealRepository`
   - Update `AppealService` to use repository
   - Update tests
   - Remove appeal methods from `FirestoreService`

2. **Continue with UserBlockService**

   - Create `UserBlockRepository` interface
   - Implement `FirebaseUserBlockRepository`
   - Update `UserBlockService` to use repository
   - Update tests
   - Remove user block methods from `FirestoreService`

3. **Continue with other services in order of complexity**

   - UserMuteService
   - UserRestrictService
   - ReportingService
   - SuspensionService
   - ReputationService

4. **Final cleanup**
   - Remove all domain-specific methods from `FirestoreService`
   - Update any remaining references
   - Run full test suite
   - Verify no functionality is lost

### Backward Compatibility

1. **Maintain Public APIs**

   - Services keep same method signatures
   - No breaking changes to consumers
   - Gradual migration possible

2. **Legacy Support**
   - Keep `FirestoreService` during transition
   - Mark deprecated methods
   - Remove after all services migrated

## Risk Mitigation

### Potential Issues

1. **Circular Dependencies**

   - Use dependency injection
   - Lazy loading where needed
   - Clear dependency graph

2. **Performance Impact**

   - Repository pattern adds abstraction layer
   - Monitor performance metrics
   - Optimize if needed

3. **Breaking Changes**
   - Maintain backward compatibility
   - Gradual migration
   - Comprehensive testing

### Success Criteria

1. **All tests pass**
2. **No functionality lost**
3. **Services are more testable**
4. **Code is more maintainable**
5. **Clear separation of concerns**

## Timeline Estimate

- **Phase 7A**: 1-2 days (Repository interfaces)
- **Phase 7B**: 3-4 days (Firebase implementations)
- **Phase 7C**: 2-3 days (Service updates)
- **Phase 7D**: 1 day (FirestoreService cleanup)
- **Phase 7E**: 2-3 days (Test updates)

**Total**: 9-13 days

## Next Steps

1. **Review and approve this plan**
2. **Start with Phase 7A** (Repository interfaces)
3. **Implement incrementally** with thorough testing
4. **Monitor for issues** and adjust as needed
5. **Document lessons learned** for future refactors

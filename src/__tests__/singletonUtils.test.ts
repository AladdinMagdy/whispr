import { destroySingleton, resetSingleton } from "../utils/singletonUtils";

describe("singletonUtils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("destroySingleton", () => {
    it("should destroy singleton with destroyInstance method", () => {
      // Arrange
      const mockDestroyInstance = jest.fn();
      const serviceClass = {
        instance: { someData: "test" },
        destroyInstance: mockDestroyInstance,
      };

      // Act
      destroySingleton(serviceClass, "TestService");

      // Assert
      expect(mockDestroyInstance).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        "🗑️ TestService singleton destroyed"
      );
    });

    it("should destroy singleton by clearing instance when no destroyInstance method", () => {
      // Arrange
      const serviceClass = {
        instance: { someData: "test" },
      };

      // Act
      destroySingleton(serviceClass, "TestService");

      // Assert
      expect(serviceClass.instance).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(
        "🗑️ TestService singleton destroyed"
      );
    });

    it("should handle service class with no instance", () => {
      // Arrange
      const serviceClass = {
        destroyInstance: jest.fn(),
      };

      // Act
      destroySingleton(serviceClass, "TestService");

      // Assert
      expect(serviceClass.destroyInstance).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });

    it("should handle service class with null instance", () => {
      // Arrange
      const serviceClass = {
        instance: null,
        destroyInstance: jest.fn(),
      };

      // Act
      destroySingleton(serviceClass, "TestService");

      // Assert
      expect(serviceClass.destroyInstance).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });

    it("should handle service class with undefined instance", () => {
      // Arrange
      const serviceClass = {
        instance: undefined,
        destroyInstance: jest.fn(),
      };

      // Act
      destroySingleton(serviceClass, "TestService");

      // Assert
      expect(serviceClass.destroyInstance).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });

    it("should handle service class with falsy instance", () => {
      // Arrange
      const serviceClass = {
        instance: false,
        destroyInstance: jest.fn(),
      };

      // Act
      destroySingleton(serviceClass, "TestService");

      // Assert
      expect(serviceClass.destroyInstance).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
    });

    it("should handle service class with empty object instance", () => {
      // Arrange
      const serviceClass = {
        instance: {},
        destroyInstance: jest.fn(),
      };

      // Act
      destroySingleton(serviceClass, "TestService");

      // Assert
      expect(serviceClass.destroyInstance).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        "🗑️ TestService singleton destroyed"
      );
    });

    it("should handle service class with complex instance", () => {
      // Arrange
      const complexInstance = {
        data: { nested: { value: "test" } },
        methods: { test: () => "test" },
        arrays: [1, 2, 3],
      };
      const mockDestroyInstance = jest.fn();
      const serviceClass = {
        instance: complexInstance,
        destroyInstance: mockDestroyInstance,
      };

      // Act
      destroySingleton(serviceClass, "ComplexService");

      // Assert
      expect(mockDestroyInstance).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        "🗑️ ComplexService singleton destroyed"
      );
    });

    it("should handle service class with async destroyInstance method", async () => {
      // Arrange
      const mockDestroyInstance = jest.fn().mockResolvedValue(undefined);
      const serviceClass = {
        instance: { someData: "test" },
        destroyInstance: mockDestroyInstance,
      };

      // Act
      destroySingleton(serviceClass, "AsyncService");

      // Assert
      expect(mockDestroyInstance).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        "🗑️ AsyncService singleton destroyed"
      );
    });

    it("should handle service class with destroyInstance that throws error", () => {
      // Arrange
      const error = new Error("Destroy failed");
      const mockDestroyInstance = jest.fn().mockImplementation(() => {
        throw error;
      });
      const serviceClass = {
        instance: { someData: "test" },
        destroyInstance: mockDestroyInstance,
      };

      // Act & Assert
      expect(() => {
        destroySingleton(serviceClass, "ErrorService");
      }).toThrow("Destroy failed");
    });

    it("should handle different service names", () => {
      // Arrange
      const serviceClass = {
        instance: { someData: "test" },
        destroyInstance: jest.fn(),
      };

      // Act
      destroySingleton(serviceClass, "UserService");
      destroySingleton(serviceClass, "AuthService");
      destroySingleton(serviceClass, "StorageService");

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        "🗑️ UserService singleton destroyed"
      );
      expect(console.log).toHaveBeenCalledWith(
        "🗑️ AuthService singleton destroyed"
      );
      expect(console.log).toHaveBeenCalledWith(
        "🗑️ StorageService singleton destroyed"
      );
    });
  });

  describe("resetSingleton", () => {
    it("should reset singleton with resetInstance method", () => {
      // Arrange
      const mockResetInstance = jest.fn();
      const serviceClass = {
        instance: { someData: "test" },
        resetInstance: mockResetInstance,
      };

      // Act
      resetSingleton(serviceClass, "TestService");

      // Assert
      expect(mockResetInstance).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        "🔄 TestService singleton reset successfully"
      );
    });

    it("should handle service class with no resetInstance method", () => {
      // Arrange
      const serviceClass = {
        instance: { someData: "test" },
      };

      // Act
      resetSingleton(serviceClass, "TestService");

      // Assert
      expect(console.log).not.toHaveBeenCalled();
    });

    it("should handle service class with null resetInstance method", () => {
      // Arrange
      const serviceClass = {
        instance: { someData: "test" },
        resetInstance: null as any,
      };

      // Act
      resetSingleton(serviceClass, "TestService");

      // Assert
      expect(console.log).not.toHaveBeenCalled();
    });

    it("should handle service class with undefined resetInstance method", () => {
      // Arrange
      const serviceClass = {
        instance: { someData: "test" },
        resetInstance: undefined,
      };

      // Act
      resetSingleton(serviceClass, "TestService");

      // Assert
      expect(console.log).not.toHaveBeenCalled();
    });

    it("should handle service class with non-function resetInstance", () => {
      // Arrange
      const serviceClass = {
        instance: { someData: "test" },
        resetInstance: "not a function" as any,
      };

      // Act
      resetSingleton(serviceClass, "TestService");

      // Assert
      expect(console.log).not.toHaveBeenCalled();
    });

    it("should handle service class with async resetInstance method", async () => {
      // Arrange
      const mockResetInstance = jest.fn().mockResolvedValue(undefined);
      const serviceClass = {
        instance: { someData: "test" },
        resetInstance: mockResetInstance,
      };

      // Act
      resetSingleton(serviceClass, "AsyncService");

      // Assert
      expect(mockResetInstance).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        "🔄 AsyncService singleton reset successfully"
      );
    });

    it("should handle service class with resetInstance that throws error", () => {
      // Arrange
      const error = new Error("Reset failed");
      const mockResetInstance = jest.fn().mockImplementation(() => {
        throw error;
      });
      const serviceClass = {
        instance: { someData: "test" },
        resetInstance: mockResetInstance,
      };

      // Act & Assert
      expect(() => {
        resetSingleton(serviceClass, "ErrorService");
      }).toThrow("Reset failed");
    });

    it("should handle different service names", () => {
      // Arrange
      const serviceClass = {
        instance: { someData: "test" },
        resetInstance: jest.fn(),
      };

      // Act
      resetSingleton(serviceClass, "UserService");
      resetSingleton(serviceClass, "AuthService");
      resetSingleton(serviceClass, "StorageService");

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        "🔄 UserService singleton reset successfully"
      );
      expect(console.log).toHaveBeenCalledWith(
        "🔄 AuthService singleton reset successfully"
      );
      expect(console.log).toHaveBeenCalledWith(
        "🔄 StorageService singleton reset successfully"
      );
    });

    it("should handle service class with complex resetInstance logic", () => {
      // Arrange
      const mockResetInstance = jest.fn().mockImplementation(() => {
        // Simulate complex reset logic
        (serviceClass as any).instance = { reset: true, timestamp: Date.now() };
      });
      const serviceClass = {
        instance: { someData: "test" },
        resetInstance: mockResetInstance,
      };

      // Act
      resetSingleton(serviceClass, "ComplexService");

      // Assert
      expect(mockResetInstance).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        "🔄 ComplexService singleton reset successfully"
      );
    });

    it("should handle service class with no instance property", () => {
      // Arrange
      const serviceClass = {
        resetInstance: jest.fn(),
      };

      // Act
      resetSingleton(serviceClass, "NoInstanceService");

      // Assert
      expect(serviceClass.resetInstance).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        "🔄 NoInstanceService singleton reset successfully"
      );
    });

    it("should handle empty service class", () => {
      // Arrange
      const serviceClass = {};

      // Act
      resetSingleton(serviceClass, "TestService");

      // Assert
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe("integration scenarios", () => {
    it("should handle service class with both destroyInstance and resetInstance", () => {
      // Arrange
      const mockDestroyInstance = jest.fn();
      const mockResetInstance = jest.fn();
      const serviceClass = {
        instance: { someData: "test" },
        destroyInstance: mockDestroyInstance,
        resetInstance: mockResetInstance,
      };

      // Act
      resetSingleton(serviceClass, "TestService");
      destroySingleton(serviceClass, "TestService");

      // Assert
      expect(mockResetInstance).toHaveBeenCalledTimes(1);
      expect(mockDestroyInstance).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(
        "🔄 TestService singleton reset successfully"
      );
      expect(console.log).toHaveBeenCalledWith(
        "🗑️ TestService singleton destroyed"
      );
    });

    it("should handle multiple service classes", () => {
      // Arrange
      const serviceClass1 = {
        instance: { data: "service1" },
        destroyInstance: jest.fn(),
        resetInstance: jest.fn(),
      };
      const serviceClass2 = {
        instance: { data: "service2" },
        destroyInstance: jest.fn(),
        resetInstance: jest.fn(),
      };

      // Act
      resetSingleton(serviceClass1, "Service1");
      resetSingleton(serviceClass2, "Service2");
      destroySingleton(serviceClass1, "Service1");
      destroySingleton(serviceClass2, "Service2");

      // Assert
      expect(serviceClass1.resetInstance).toHaveBeenCalledTimes(1);
      expect(serviceClass2.resetInstance).toHaveBeenCalledTimes(1);
      expect(serviceClass1.destroyInstance).toHaveBeenCalledTimes(1);
      expect(serviceClass2.destroyInstance).toHaveBeenCalledTimes(1);
    });
  });
});

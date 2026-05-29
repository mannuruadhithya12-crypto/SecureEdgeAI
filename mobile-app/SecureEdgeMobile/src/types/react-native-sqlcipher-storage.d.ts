declare module 'react-native-sqlcipher-storage' {
  interface SQLError {
    code: number;
    message: string;
  }

  interface Results {
    rows: {
      length: number;
      item: (index: number) => any;
      raw: () => any[];
    };
    rowsAffected: number;
    insertId?: number;
  }

  interface Database {
    executeSql(sql: string, params?: any[]): Promise<[Results]>;
    transaction(fn: (tx: Transaction) => void): Promise<void>;
    close(): Promise<void>;
  }

  interface Transaction {
    executeSql(sql: string, params?: any[]): void;
  }

  interface DatabaseParams {
    name: string;
    location?: string;
    key?: string;
  }

  const SQLite: {
    enablePromise(flag: boolean): void;
    openDatabase(params: DatabaseParams): Promise<Database>;
    deleteDatabase(params: { name: string; location?: string }): Promise<void>;
  };

  export default SQLite;
}

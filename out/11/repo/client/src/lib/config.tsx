import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface Config {
  public_readonly: boolean;
}

interface ConfigContextValue {
  config: Config | null;
  loading: boolean;
}

const ConfigContext = createContext<ConfigContextValue>({ config: null, loading: true });

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/config")
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        setLoading(false);
      })
      .catch(() => {
        setConfig({ public_readonly: false });
        setLoading(false);
      });
  }, []);

  return (
    <ConfigContext.Provider value={{ config, loading }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  return useContext(ConfigContext);
}

export function useReadOnlyMode() {
  const { config, loading } = useConfig();
  return { 
    isReadOnly: config?.public_readonly ?? false, 
    loading 
  };
}

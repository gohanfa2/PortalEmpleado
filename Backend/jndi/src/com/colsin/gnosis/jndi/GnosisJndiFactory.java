package com.colsin.gnosis.jndi;

import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Enumeration;
import java.util.Hashtable;
import java.util.Properties;
import java.util.logging.Logger;

import javax.naming.Binding;
import javax.naming.Context;
import javax.naming.Name;
import javax.naming.NameClassPair;
import javax.naming.NameParser;
import javax.naming.NamingEnumeration;
import javax.naming.NamingException;
import javax.naming.NoInitialContextException;
import javax.naming.OperationNotSupportedException;
import javax.naming.spi.InitialContextFactory;
import javax.sql.DataSource;

/**
 * Provee un contexto JNDI para el proceso standalone de JasperStarter.
 *
 * JasperStarter no corre dentro de un contenedor Java EE, por lo que no hay
 * ningun InitialContextFactory registrado. Los scripts de Gnosis
 * (NumerosALetrasScriptlet.f_acumulado y f_retorna_empresa) resuelven su
 * conexion con new InitialContext().lookup("java:comp/env/jdbc/..."), lo que
 * falla con NoInitialContextException y hace que el script devuelva 0 de forma
 * silenciosa.
 *
 * Esta factoria se registra mediante java.naming.factory.initial y devuelve un
 * Context que, para cualquier nombre, entrega un DataSource respaldado por la
 * conexion JDBC declarada en jndi.properties. Asi los scripts existentes
 * funcionan sin necesidad de recompilar GnosisObject.
 *
 * Propiedades esperadas en jndi.properties:
 *   java.naming.factory.initial=com.colsin.gnosis.jndi.GnosisJndiFactory
 *   colsin.jdbc.url=jdbc:sqlserver://host:puerto;databaseName=...
 *   colsin.jdbc.user=usuario
 *   colsin.jdbc.password=clave
 *   colsin.jdbc.driver=com.microsoft.sqlserver.jdbc.SQLServerDriver
 */
public class GnosisJndiFactory implements InitialContextFactory {

    public static final String PROP_URL = "colsin.jdbc.url";
    public static final String PROP_USER = "colsin.jdbc.user";
    public static final String PROP_PASSWORD = "colsin.jdbc.password";
    public static final String PROP_DRIVER = "colsin.jdbc.driver";

    private static final String DEFAULT_DRIVER = "com.microsoft.sqlserver.jdbc.SQLServerDriver";

    private final Properties config = new Properties();
    private final Logger logger = Logger.getLogger(GnosisJndiFactory.class.getName());

    public GnosisJndiFactory() {
        this(null);
    }

    public GnosisJndiFactory(Hashtable<?, ?> environment) {
        loadConfig(environment);
        loadDriver();
    }

    public Context getInitialContext(Hashtable<?, ?> environment) {
        // NamingManager instancia la factoria con el constructor sin argumentos y
        // solo despues entrega la configuracion (jndi.properties) en environment,
        // por lo que hay que cargarla aqui antes de construir el Context.
        loadConfig(environment);
        loadDriver();
        return new GnosisContext(this, config);
    }

    Properties getConfig() {
        return config;
    }

    Logger getLogger() {
        return logger;
    }

    private void loadConfig(Hashtable<?, ?> environment) {
        if (environment != null) {
            for (Enumeration<?> keys = environment.keys(); keys.hasMoreElements();) {
                Object key = keys.nextElement();
                Object value = environment.get(key);
                if (key != null && value != null) {
                    config.setProperty(String.valueOf(key), String.valueOf(value));
                }
            }
        }
        // Las propiedades del sistema tienen prioridad sobre jndi.properties para
        // permitir sobreescribir la configuracion sin recompilar nada.
        copySystemProperty(PROP_URL);
        copySystemProperty(PROP_USER);
        copySystemProperty(PROP_PASSWORD);
        copySystemProperty(PROP_DRIVER);
    }

    private void copySystemProperty(String name) {
        String value = System.getProperty(name);
        if (value != null && !value.isEmpty()) {
            config.setProperty(name, value);
        }
    }

    private void loadDriver() {
        String driver = config.getProperty(PROP_DRIVER, DEFAULT_DRIVER);
        try {
            Class.forName(driver);
        } catch (ClassNotFoundException e) {
            logger.warning("No se encontro el driver JDBC '" + driver + "': " + e.getMessage());
        }
    }

    private String require(String name) {
        String value = config.getProperty(name);
        if (value == null || value.isEmpty()) {
            throw new IllegalStateException(
                    "Falta la propiedad '" + name + "' en jndi.properties para el DataSource de Gnosis");
        }
        return value;
    }

    private Connection openConnection() throws SQLException {
        return DriverManager.getConnection(require(PROP_URL), require(PROP_USER), require(PROP_PASSWORD));
    }

    /**
     * DataSource minimo respaldado por DriverManager.
     */
    static class GnosisDataSource implements DataSource {

        private final GnosisJndiFactory factory;
        private PrintWriter logWriter;
        private int loginTimeout;

        GnosisDataSource(GnosisJndiFactory factory) {
            this.factory = factory;
        }

        public Connection getConnection() throws SQLException {
            return factory.openConnection();
        }

        public Connection getConnection(String username, String password) throws SQLException {
            return DriverManager.getConnection(factory.require(PROP_URL), username, password);
        }

        public PrintWriter getLogWriter() {
            return logWriter;
        }

        public void setLogWriter(PrintWriter out) {
            this.logWriter = out;
        }

        public void setLoginTimeout(int seconds) {
            this.loginTimeout = seconds;
        }

        public int getLoginTimeout() {
            return loginTimeout;
        }

        public Logger getParentLogger() {
            return Logger.getLogger("com.colsin.gnosis.jndi");
        }

        public <T> T unwrap(Class<T> iface) throws SQLException {
            if (iface.isInstance(this)) {
                return iface.cast(this);
            }
            throw new SQLException("No se puede unwrap a " + iface.getName());
        }

        public boolean isWrapperFor(Class<?> iface) {
            return iface.isInstance(this);
        }
    }

    /**
     * Contexto minimo: solo resuelve lookups devolviendo el DataSource.
     */
    static class GnosisContext implements Context {

        private final GnosisJndiFactory factory;
        private final GnosisDataSource dataSource;

        GnosisContext(GnosisJndiFactory factory, Properties config) {
            this.factory = factory;
            this.dataSource = new GnosisDataSource(factory);
            factory.getLogger().info("Gnosis JNDI activo. DataSource JDBC -> " + config.getProperty(PROP_URL));
        }

        private DataSource resolve(String name) {
            factory.getLogger().fine("Lookup JNDI: " + name);
            return dataSource;
        }

        private NamingException unsupported() {
            return new OperationNotSupportedException("El contexto JNDI de Gnosis solo soporta lookup");
        }

        public Object lookup(Name name) {
            return resolve(name == null ? null : name.toString());
        }

        public Object lookup(String name) {
            return resolve(name);
        }

        public void close() {
            // No hay recursos que liberar.
        }

        public void bind(Name name, Object obj) throws NamingException {
            throw unsupported();
        }

        public void bind(String name, Object obj) throws NamingException {
            throw unsupported();
        }

        public void rebind(Name name, Object obj) throws NamingException {
            throw unsupported();
        }

        public void rebind(String name, Object obj) throws NamingException {
            throw unsupported();
        }

        public void unbind(Name name) throws NamingException {
            throw unsupported();
        }

        public void unbind(String name) throws NamingException {
            throw unsupported();
        }

        public void rename(Name oldName, Name newName) throws NamingException {
            throw unsupported();
        }

        public void rename(String oldName, String newName) throws NamingException {
            throw unsupported();
        }

        public NamingEnumeration<NameClassPair> list(Name name) throws NamingException {
            throw unsupported();
        }

        public NamingEnumeration<NameClassPair> list(String name) throws NamingException {
            throw unsupported();
        }

        public NamingEnumeration<Binding> listBindings(Name name) throws NamingException {
            throw unsupported();
        }

        public NamingEnumeration<Binding> listBindings(String name) throws NamingException {
            throw unsupported();
        }

        public void destroySubcontext(Name name) throws NamingException {
            throw unsupported();
        }

        public void destroySubcontext(String name) throws NamingException {
            throw unsupported();
        }

        public Context createSubcontext(Name name) throws NamingException {
            throw unsupported();
        }

        public Context createSubcontext(String name) throws NamingException {
            throw unsupported();
        }

        public NameParser getNameParser(Name name) throws NamingException {
            throw unsupported();
        }

        public NameParser getNameParser(String name) throws NamingException {
            throw unsupported();
        }

        public Name composeName(Name name, Name prefix) throws NamingException {
            throw unsupported();
        }

        public String composeName(String name, String prefix) throws NamingException {
            throw unsupported();
        }

        public Object addToEnvironment(String propName, Object propVal) throws NamingException {
            throw unsupported();
        }

        public Object removeFromEnvironment(String propName) throws NamingException {
            throw unsupported();
        }

        public Object lookupLink(Name name) throws NamingException {
            return lookup(name);
        }

        public Object lookupLink(String name) throws NamingException {
            return lookup(name);
        }

        public String getNameInNamespace() throws NamingException {
            return "";
        }

        public Hashtable<?, ?> getEnvironment() throws NamingException {
            Hashtable<String, String> env = new Hashtable<String, String>();
            for (Enumeration<?> keys = factory.getConfig().propertyNames(); keys.hasMoreElements();) {
                String key = String.valueOf(keys.nextElement());
                env.put(key, factory.getConfig().getProperty(key));
            }
            return env;
        }

        public NamingEnumeration<Name> getMoreResults() throws NamingException {
            throw new NoInitialContextException();
        }
    }
}

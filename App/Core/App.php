<?php
class App
{
  private $controller = "Home"; // default file Controllers/Home.php 

  private $method = "index"; // default method
  private $params = [];

  public function __construct()
  {

    $url = $this->parseURL(); // "home/index" -> ["home", "index"] (class, method)
    // var_dump($url);
    // exit;
    if (isset($url[0])) {
      if (file_exists(__DIR__ . "/../Controllers/" . ucfirst($url[0]) . '.php')) {
        $this->controller = ucfirst($url[0]);
        unset($url[0]); // agar sisanya bisa dipakai params
      }
    }

    require_once __DIR__ . "/../Controllers/" . $this->controller . ".php";
    $controllerClass = "App\\Controllers\\" . $this->controller;

    if (!class_exists($controllerClass)) {
      throw new Exception("Controller class $controllerClass not found");
    }

    $this->controller = new $controllerClass();

    // mengecek apakah method di set di url
    if (isset($url[1]) && method_exists($this->controller, $url[1])) {
      $this->method = $url[1];
      unset($url[1]); // agar sisanya bisa dipakai params
    }

    //cek apa ada sisa utk parameter
    if (!empty($url)) {
      $this->params = array_values($url);
    }

    //jalankan controller, method dan param jika
    call_user_func_array([$this->controller, $this->method], $this->params);
  }

  public function parseURL()
  {
    if (isset($_SERVER['REQUEST_URI'])) {

      $url = ltrim($_SERVER['REQUEST_URI'], '/');
      $url = filter_var($url, FILTER_SANITIZE_URL);
      // ambil nilai di sebelah tanya tanya sebaga parameter
      $param = explode('?', $url)[1] ?? '';
      // ambil hanya huruf, "/", "_", dan "-"
      $url = preg_replace('/[^a-zA-Z\/_\-].*$/', '', $url);
      // pecah class & method
      $url = explode('/', $url);
      // jika method format "nama-method" ubah jadi "namaMethod"
      if (isset($url[1]) && strpos($url[1], '-')) {
        $url[1] = $this->kebabToCamel($url[1]);
      }
      // ubah "key=value,key2=value2" jadi ["key" => "value", "key2" => "value2"]
      $result = [];
      if (!empty($param)) {
        foreach (explode(',', $param) as $pair) {
          if (strpos($pair, '=') === false) {
            continue;
          }
          [$key, $value] = explode('=', $pair, 2);
          $result[$key] = $value;
        }
      }

      $url[3] = $result;
      return $url; // 1=class, 2=method, 3=params
    }
  }

  private function kebabToCamel(string $str): string
  {
    return lcfirst(str_replace(' ', '', ucwords(str_replace('-', ' ', $str))));
  }
}
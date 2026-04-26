package sdk

import ("bytes";"encoding/json";"net/http")
type Client struct{EngineURL string; HTTP *http.Client}
func New(engineURL string)*Client{return &Client{EngineURL:engineURL,HTTP:&http.Client{}}}
func (c *Client)ApplyAction(action map[string]any)(*http.Response,error){body,_:=json.Marshal(action); return c.HTTP.Post(c.EngineURL+"/actions","application/json",bytes.NewBuffer(body))}
